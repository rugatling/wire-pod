package main

import (
	"github.com/rugatling/wire-pod/chipper/pkg/initwirepod"
	stt "github.com/rugatling/wire-pod/chipper/pkg/wirepod/stt/vosk"
)

func main() {
	initwirepod.StartFromProgramInit(stt.Init, stt.STT, stt.Name)
}
