// Package util provides utility functions used across the CLIProxyAPI application.
package util

import (
	"net/url"
	"strings"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/registry"
	log "github.com/sirupsen/logrus"
)

// GetProviderName 核心逻辑：将 Claude 模型强制映射到 codex 供应商
func GetProviderName(modelName string) []string {
	if modelName == "" {
		return nil
	}

	providers := make([]string, 0, 4)
	seen := make(map[string]struct{})

	appendProvider := func(name string) {
		if name == "" {
			return
		}
		if _, exists := seen[name]; exists {
			return
		}
		seen[name] = struct{}{}
		providers = append(providers, name)
	}

	// 关键对齐点：这里必须是 "codex"，对应 TOKENS 变量里的 provider 名
	if strings.HasPrefix(strings.ToLower(modelName), "claude-") {
		appendProvider("codex")
	}

	for _, provider := range registry.GetGlobalRegistry().GetModelProviders(modelName) {
		appendProvider(provider)
	}

	return providers
}

func ResolveAutoModel(modelName string) string {
	if modelName != "auto" {
		return modelName
	}
	firstModel, err := registry.GetGlobalRegistry().GetFirstAvailableModel("")
	if err != nil {
		return modelName
	}
	return firstModel
}

func IsOpenAICompatibilityAlias(modelName string, cfg *config.Config) bool {
	if cfg == nil {
		return false
	}
	for _, compat := range cfg.OpenAICompatibility {
		for _, model := range compat.Models {
			if model.Alias == modelName {
				return true
			}
		}
	}
	return false
}

func GetOpenAICompatibilityConfig(alias string, cfg *config.Config) (*config.OpenAICompatibility, *config.OpenAICompatibilityModel) {
	if cfg == nil {
		return nil, nil
	}
	for _, compat := range cfg.OpenAICompatibility {
		for _, model := range compat.Models {
			if model.Alias == alias {
				return &compat, &model
			}
		}
	}
	return nil, nil
}

func InArray(hystack []string, needle string) bool {
	for _, item := range hystack {
		if needle == item {
			return true
		}
	}
	return false
}

func HideAPIKey(apiKey string) string {
	if len(apiKey) > 8 {
		return apiKey[:4] + "..." + apiKey[len(apiKey)-4:]
	}
	return apiKey
}

func MaskAuthorizationHeader(value string) string {
	parts := strings.SplitN(strings.TrimSpace(value), " ", 2)
	if len(parts) < 2 {
		return HideAPIKey(value)
	}
	return parts[0] + " " + HideAPIKey(parts[1])
}

func MaskSensitiveHeaderValue(key, value string) string {
	lowerKey := strings.ToLower(strings.TrimSpace(key))
	switch {
	case strings.Contains(lowerKey, "authorization"):
		return MaskAuthorizationHeader(value)
	case strings.Contains(lowerKey, "api-key"), strings.Contains(lowerKey, "apikey"), strings.Contains(lowerKey, "token"), strings.Contains(lowerKey, "secret"):
		return HideAPIKey(value)
	default:
		return value
	}
}

func MaskSensitiveQuery(raw string) string {
	if raw == "" {
		return ""
	}
	parts := strings.Split(raw, "&")
	for i, part := range parts {
		if idx := strings.Index(part, "="); idx >= 0 {
			key := part[:idx]
			if shouldMaskQueryParam(key) {
				parts[i] = key + "=" + url.QueryEscape(HideAPIKey(part[idx+1:]))
			}
		}
	}
	return strings.Join(parts, "&")
}

func shouldMaskQueryParam(key string) bool {
	key = strings.ToLower(strings.TrimSpace(key))
	return key == "key" || strings.Contains(key, "api-key") || strings.Contains(key, "token") || strings.Contains(key, "secret")
}
