package keeper

import (
	"context"

	"localchain/x/records/types"

	"cosmossdk.io/collections"
	sdk "github.com/cosmos/cosmos-sdk/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func (q queryServer) ListRecords(ctx context.Context, req *types.QueryListRecordsRequest) (*types.QueryListRecordsResponse, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "invalid request")
	}

	sdkCtx := sdk.UnwrapSDKContext(ctx)
	var records []types.Record

	err := q.k.Records.Walk(sdkCtx, nil, func(key uint64, value types.Record) (stop bool, err error) {
		// Filter by creator if specified
		if req.Creator != "" && value.Creator != req.Creator {
			return false, nil
		}
		records = append(records, value)
		return false, nil
	})

	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &types.QueryListRecordsResponse{
		Records: records,
	}, nil
}

func (q queryServer) GetRecord(ctx context.Context, req *types.QueryGetRecordRequest) (*types.QueryGetRecordResponse, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "invalid request")
	}

	sdkCtx := sdk.UnwrapSDKContext(ctx)
	record, err := q.k.Records.Get(sdkCtx, req.Id)
	if err != nil {
		if err == collections.ErrNotFound {
			return nil, status.Error(codes.NotFound, "record not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &types.QueryGetRecordResponse{
		Record: record,
	}, nil
}
