package server

import (
	"time"

	pb "github.com/digital-dream-labs/api/go/chipperpb"
	"github.com/rugatling/wire-pod/chipper/pkg/logger"
	"github.com/rugatling/wire-pod/chipper/pkg/vtt"
)

// StreamingKnowledgeGraph is used for knowledge graph request/responses
func (s *Server) StreamingKnowledgeGraph(stream pb.ChipperGrpc_StreamingKnowledgeGraphServer) error {
	recvTime := time.Now()
	req, err := stream.Recv()
	if err != nil {
		logger.Println("Knowledge graph error")
		logger.Println(err)

		return err
	}

	if _, err = s.kg.ProcessKnowledgeGraph(
		&vtt.KnowledgeGraphRequest{
			Time:       recvTime,
			Stream:     stream,
			Device:     req.DeviceId,
			Session:    req.Session,
			LangString: req.LanguageCode.String(),
			FirstReq:   req,
			AudioCodec: req.AudioEncoding,
			// Why is this not passed
			// Mode:
		},
	); err != nil {
		logger.Println("Knowledge graph error")
		logger.Println(err)
		return err
	}

	return nil
}
