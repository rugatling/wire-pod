//go:build !inbuiltble
// +build !inbuiltble

package botsetup

import "github.com/rugatling/wire-pod/chipper/pkg/logger"

func RegisterBLEAPI() {
	logger.Println("BLE API is unregistered")
}
