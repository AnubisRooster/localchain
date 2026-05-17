package types

import (
	fmt "fmt"

	query "github.com/cosmos/cosmos-sdk/types/query"
)

// QueryListRecordsRequestWithPagination extends the base request with pagination
type QueryListRecordsRequestWithPagination struct {
	Pagination *query.PageRequest `protobuf:"bytes,1,opt,name=pagination,proto3" json:"pagination,omitempty"`
	Creator    string             `protobuf:"bytes,2,opt,name=creator,proto3" json:"creator,omitempty"`
}

func (m *QueryListRecordsRequestWithPagination) Reset()         { *m = QueryListRecordsRequestWithPagination{} }
func (m *QueryListRecordsRequestWithPagination) String() string { return fmt.Sprintf("%v", *m) }
func (m *QueryListRecordsRequestWithPagination) GetPagination() *query.PageRequest {
	if m != nil {
		return m.Pagination
	}
	return nil
}
func (m *QueryListRecordsRequestWithPagination) GetCreator() string {
	if m != nil {
		return m.Creator
	}
	return ""
}

// QueryListRecordsResponseWithRecords extends the base response with records
type QueryListRecordsResponseWithRecords struct {
	Records    []Record            `protobuf:"bytes,1,rep,name=records,proto3" json:"records"`
	Pagination *query.PageResponse `protobuf:"bytes,2,opt,name=pagination,proto3" json:"pagination,omitempty"`
}

func (m *QueryListRecordsResponseWithRecords) Reset()         { *m = QueryListRecordsResponseWithRecords{} }
func (m *QueryListRecordsResponseWithRecords) String() string { return fmt.Sprintf("%v", *m) }
func (m *QueryListRecordsResponseWithRecords) GetRecords() []Record {
	if m != nil {
		return m.Records
	}
	return nil
}
func (m *QueryListRecordsResponseWithRecords) GetPagination() *query.PageResponse {
	if m != nil {
		return m.Pagination
	}
	return nil
}

// QueryGetRecordRequest is the request type for GetRecord RPC
type QueryGetRecordRequest struct {
	Id uint64 `protobuf:"varint,1,opt,name=id,proto3" json:"id,omitempty"`
}

func (m *QueryGetRecordRequest) Reset()         { *m = QueryGetRecordRequest{} }
func (m *QueryGetRecordRequest) String() string { return fmt.Sprintf("%v", *m) }
func (m *QueryGetRecordRequest) GetId() uint64 {
	if m != nil {
		return m.Id
	}
	return 0
}

// QueryGetRecordResponse is the response type for GetRecord RPC
type QueryGetRecordResponse struct {
	Record Record `protobuf:"bytes,1,opt,name=record,proto3" json:"record"`
}

func (m *QueryGetRecordResponse) Reset()         { *m = QueryGetRecordResponse{} }
func (m *QueryGetRecordResponse) String() string { return fmt.Sprintf("%v", *m) }
func (m *QueryGetRecordResponse) GetRecord() Record {
	if m != nil {
		return m.Record
	}
	return Record{}
}
