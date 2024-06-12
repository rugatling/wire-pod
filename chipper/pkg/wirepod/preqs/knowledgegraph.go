package processreqs

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	pb "github.com/digital-dream-labs/api/go/chipperpb"
	"github.com/rugatling/wire-pod/chipper/pkg/logger"
	"github.com/rugatling/wire-pod/chipper/pkg/vars"
	"github.com/rugatling/wire-pod/chipper/pkg/vtt"
	sr "github.com/rugatling/wire-pod/chipper/pkg/wirepod/speechrequest"
	"github.com/pkg/errors"
	"github.com/soundhound/houndify-sdk-go"
)

var HKGclient houndify.Client
var HoundEnable bool = true

func ParseSpokenResponse(serverResponseJSON string) (string, error) {
	result := make(map[string]interface{})
	err := json.Unmarshal([]byte(serverResponseJSON), &result)
	if err != nil {
		logger.Println(err.Error())
		return "", errors.New("failed to decode json")
	}
	if !strings.EqualFold(result["Status"].(string), "OK") {
		return "", errors.New(result["ErrorMessage"].(string))
	}
	if result["NumToReturn"].(float64) < 1 {
		return "", errors.New("no results to return")
	}
	return result["AllResults"].([]interface{})[0].(map[string]interface{})["SpokenResponseLong"].(string), nil
}

func InitKnowledge() {
	if vars.APIConfig.Knowledge.Enable && vars.APIConfig.Knowledge.Provider == "houndify" {
		if vars.APIConfig.Knowledge.ID == "" || vars.APIConfig.Knowledge.Key == "" {
			vars.APIConfig.Knowledge.Enable = false
			logger.Println("Houndify Client Key or ID was empty, not initializing kg client")
		} else {
			HKGclient = houndify.Client{
				ClientID:  vars.APIConfig.Knowledge.ID,
				ClientKey: vars.APIConfig.Knowledge.Key,
			}
			HKGclient.EnableConversationState()
			logger.Println("Initialized Houndify client")
		}
	}
}

var NoResult string = "NoResultCommand"
var NoResultSpoken string

func houndifyKG(req sr.SpeechRequest) string {
	var apiResponse string
	if vars.APIConfig.Knowledge.Enable && vars.APIConfig.Knowledge.Provider == "houndify" {
		logger.Println("Sending request to Houndify...")
		serverResponse := StreamAudioToHoundify(req, HKGclient)
		apiResponse, _ = ParseSpokenResponse(serverResponse)
		logger.Println("Houndify response: " + apiResponse)
	} else {
		apiResponse = "Houndify is not enabled."
		logger.Println("Houndify is not enabled.")
	}
	return apiResponse
}

func togetherRequest(transcribedText string) string {
	sendString := "You are a helpful robot called Vector. You will be given a question asked by a user and you must provide the best answer you can. It may not be punctuated or spelled correctly. Keep the answer concise yet informative. Here is the question:"
	url := "https://api.proxyapi.ru/openai/v1/chat/completions"
	model := vars.APIConfig.Knowledge.Model
	formData := `{
"model": "` + model + `",
"messages": [
	{
	  "role": "system",
	  "content": "` + sendString + `",
	},
	{
	  "role": "user",
	  "content": "`+ transcribedText +`"
	}
  ],
"temperature": 0.7,
"max_tokens": 256,
"top_p": 1
}`
	logger.Println("Making request to PoxyAI API...")
	logger.Println("Model is " + model)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer([]byte(formData)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+vars.APIConfig.Knowledge.Key)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "There was an error making the request to Together API"
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var togetherResponse map[string]any
	err = json.Unmarshal(body, &togetherResponse)
	if err != nil {
		return "Together API returned no response."
	}
	output := togetherResponse["output"].(map[string]any)
	choice := output["choices"].([]any)
	for _, val := range choice {
		x := val.(map[string]any)
		textResponse := x["content"].(string)
		apiResponse := strings.TrimSuffix(textResponse, "</s>")
		logger.Println("PoxyAI response: " + apiResponse)
		return apiResponse
	}
	// In case text is not present in result from API, return a string saying answer was not found
	return "Answer was not found"
}

func openaiRequest(transcribedText string) string {
	var robName string
	if vars.APIConfig.Knowledge.RobotName != "" {
		robName = vars.APIConfig.Knowledge.RobotName
	} else {
		robName = "Vector"
	}
	defaultPrompt := "You are a helpful robot called " + robName + ". You will be given a question asked by a user and you must provide the best answer you can. It may not be punctuated or spelled correctly as the STT model is small. The answer will be put through TTS, so it should be a speakable string. Keep the answer concise yet informative."
	sendString := " Here is the question: "
	if strings.TrimSpace(vars.APIConfig.Knowledge.OpenAIPrompt) != "" {
		sendString = strings.TrimSpace(vars.APIConfig.Knowledge.OpenAIPrompt) + sendString
	} else {
		sendString = defaultPrompt + sendString
	}
	logger.Println("Making request to OpenproxyAI...")
	url := "https://api.proxyapi.ru/openai/v1/chat/completions"
	formData := `{
		"model": "gpt-3.5-turbo-1106",
		"messages": [
	{
	  "role": "system",
	  "content": "` + sendString + `",
	},
	{
	  "role": "user",
	  "content": "`+ transcribedText +`"
	}
  ],
		"temperature": 0.9,
		"max_tokens": 256,
		"top_p": 1,
		"frequency_penalty": 0.2,
		"presence_penalty": 0
		}`
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer([]byte(formData)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(vars.APIConfig.Knowledge.Key))
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		logger.Println(err)
		return "There was an error making the request to OpenAI."
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	type openAIStruct struct {
		ID      string `json:"id"`
		Object  string `json:"object"`
		Created int    `json:"created"`
		Model   string `json:"model"`
		Choices []struct {
			Index        int         `json:"index"`
			Message      Message     `json:"message"`
			Logprobs     interface{} `json:"logprobs"`
			FinishReason string      `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	

	type Message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}




	var openAIResponse openAIStruct
	err = json.Unmarshal(body, &openAIResponse)
	if err != nil || len(openAIResponse.Choices) == 0 {
		logger.Println("OpenproxyAI returned no response.")
		logger.Println(string(body))
		return "Open proxyAI returned no response."
	}
	apiResponse := strings.TrimSpace(openAIResponse.Choices.Message[0].Content)
	logger.Println("OpenproxyAI response: " + apiResponse)
	return apiResponse
}

func openaiKG(speechReq sr.SpeechRequest) string {
	transcribedText, err := sttHandler(speechReq)
	if err != nil {
		return "There was an error."
	}
	return openaiRequest(transcribedText)
}

func togetherKG(speechReq sr.SpeechRequest) string {
	transcribedText, err := sttHandler(speechReq)
	if err != nil {
		return "There was an error."
	}
	return togetherRequest(transcribedText)
}

// Takes a SpeechRequest, figures out knowledgegraph provider, makes request, returns API response
func KgRequest(speechReq sr.SpeechRequest) string {
	if vars.APIConfig.Knowledge.Enable {
		if vars.APIConfig.Knowledge.Provider == "houndify" {
			return houndifyKG(speechReq)
		} else if vars.APIConfig.Knowledge.Provider == "openai" {
			return openaiKG(speechReq)
		} else if vars.APIConfig.Knowledge.Provider == "together" {
			return togetherKG(speechReq)
		}
	}
	return "Knowledge graph is not enabled. This can be enabled in the web interface."
}

func (s *Server) ProcessKnowledgeGraph(req *vtt.KnowledgeGraphRequest) (*vtt.KnowledgeGraphResponse, error) {
	InitKnowledge()
	speechReq := sr.ReqToSpeechRequest(req)
	apiResponse := KgRequest(speechReq)
	kg := pb.KnowledgeGraphResponse{
		Session:     req.Session,
		DeviceId:    req.Device,
		CommandType: NoResult,
		SpokenText:  apiResponse,
	}
	logger.Println("(KG) Bot " + speechReq.Device + " request served.")
	if err := req.Stream.Send(&kg); err != nil {
		return nil, err
	}
	return nil, nil

}
