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

	limit := uint64(100)
	offset := uint64(0)
	if req.Pagination != nil {
		if req.Pagination.Limit > 0 {
			limit = req.Pagination.Limit
		}
		offset = req.Pagination.Offset
	}

	var records []types.Record
	var skipped uint64
	var total uint64

	err := q.k.Records.Walk(sdkCtx, nil, func(key uint64, value types.Record) (stop bool, err error) {
		if req.Creator != "" && value.Creator != req.Creator {
			return false, nil
		}

		total++

		if skipped < offset {
			skipped++
			return false, nil
		}

		if uint64(len(records)) >= limit {
			return true, nil
		}

		records = append(records, value)
		return false, nil
	})

	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &types.QueryListRecordsResponse{
		Records: records,
		Pagination: &types.PageResponse{
			Total: total,
		},
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
