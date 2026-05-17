package keeper

import (
	"encoding/json"

	"cosmossdk.io/collections/codec"
	"localchain/x/records/types"
)

// RecordValueCodec is a custom codec for encoding/decoding Record structs
// TODO: Switch to proto.Marshal/proto.Unmarshal once proto types are regenerated.
// JSON is used temporarily because the hand-written Record struct lacks protobuf methods.
type RecordValueCodec struct{}

func (RecordValueCodec) Encode(value types.Record) ([]byte, error) {
	return json.Marshal(value)
}

func (RecordValueCodec) Decode(b []byte) (types.Record, error) {
	var v types.Record
	err := json.Unmarshal(b, &v)
	return v, err
}

func (RecordValueCodec) EncodeJSON(value types.Record) ([]byte, error) {
	return json.Marshal(value)
}

func (RecordValueCodec) DecodeJSON(b []byte) (types.Record, error) {
	var v types.Record
	err := json.Unmarshal(b, &v)
	return v, err
}

func (RecordValueCodec) Stringify(value types.Record) string {
	b, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func (RecordValueCodec) ValueType() string {
	return "localchain/records/Record"
}

var _ codec.ValueCodec[types.Record] = RecordValueCodec{}
