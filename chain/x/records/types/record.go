package types

import (
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
// NOTE: Proto fields Summary, Content, ContentType, FileName, Tags, Labels, ContentHash
// are defined in tx.proto but tx.pb.go is stale. Run `make proto-gen` to regenerate.
// Until then, these fields are extracted from the Data JSON payload.
func NewRecord(id uint64, msg *MsgCreateRecord, timestamp int64) Record {
	return Record{
		Id:        id,
		Creator:   msg.Creator,
		Data:      msg.Data,
		CreatedAt: timestamp,
	}
}

