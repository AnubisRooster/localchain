package keeper

import (
	"context"

	"localchain/x/records/types"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func (q queryServer) ListRecords(ctx context.Context, req *types.QueryListRecordsRequest) (*types.QueryListRecordsResponse, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "invalid request")
	}

	// TODO: Process the query

	return &types.QueryListRecordsResponse{}, nil
}
