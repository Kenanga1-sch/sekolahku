package repository

import (
	"archive/zip"
	"io"
	"regexp"
	"strings"
)

// ExtractDocxVariables reads a .docx file and returns a list of variables like {{name}}
func ExtractDocxVariables(filePath string) ([]string, error) {
	r, err := zip.OpenReader(filePath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	var content string
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			defer rc.Close()
			b, err := io.ReadAll(rc)
			if err != nil {
				return nil, err
			}
			content = string(b)
			break
		}
	}

	if content == "" {
		return []string{}, nil
	}

	// Regex for {{variable}}
	re := regexp.MustCompile(`{{(.*?)}}`)
	matches := re.FindAllStringSubmatch(content, -1)

	var variables []string
	seen := make(map[string]bool)
	for _, m := range matches {
		if len(m) > 1 {
			varName := strings.TrimSpace(m[1])
			if !seen[varName] {
				variables = append(variables, varName)
				seen[varName] = true
			}
		}
	}

	return variables, nil
}
