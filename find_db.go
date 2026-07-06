package main

import (
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	root := "d:/antigravity"
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && filepath.Ext(path) == ".db" {
			fmt.Printf("File: %s | Size: %d bytes\n", path, info.Size())
		}
		return nil
	})
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}
