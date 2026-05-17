package types

import (
	"encoding/json"
	"fmt"
)

// Record represents an on-chain stored record
type Record struct {
	Id          uint64 `json:"id"`
	Creator     string `json:"creator"`
	Summary     string `json:"summary"`
	Content     string `json:"content"`
	ContentType string `json:"content_type"`
	FileName    string `json:"file_name"`
	Tags        string `json:"tags"`
	Labels      string `json:"labels"`
	Data        string `json:"data"`
	ContentHash string `json:"content_hash"`
	CreatedAt   int64  `json:"created_at"`
}

// Validate performs basic validation on a Record
func (r Record) Validate() error {
	if r.Creator == "" {
		return fmt.Errorf("creator cannot be empty")
	}
	if r.Summary == "" && r.Content == "" && r.Data == "" {
		return fmt.Errorf("record must have at least summary, content, or data")
	}
	return nil
}

// NewRecord creates a new Record from a MsgCreateRecord
// Since tx.pb.go is stale and MsgCreateRecord only exposes Creator and Data,
// we extract structured fields from the Data JSON payload.
// TODO: Replace with direct field access once proto is regenerated.
func NewRecord(id uint64, msg *MsgCreateRecord, timestamp int64) Record {
	r := Record{
		Id:        id,
		Creator:   msg.Creator,
		Data:      msg.Data,
		CreatedAt: timestamp,
	}

	var parsed struct {
		Summary     string `json:"summary"`
		Content     string `json:"content"`
		ContentType string `json:"content_type"`
		FileName    string `json:"fileName"`
		Tags        string `json:"tags"`
		Labels      string `json:"labels"`
		ContentHash string `json:"content_hash"`
	}
	if json.Unmarshal([]byte(msg.Data), &parsed) == nil {
		r.Summary = parsed.Summary
		r.Content = parsed.Content
		r.ContentType = parsed.ContentType
		r.FileName = parsed.FileName
		r.Tags = parsed.Tags
		r.Labels = parsed.Labels
		r.ContentHash = parsed.ContentHash
	}

	return r
}

