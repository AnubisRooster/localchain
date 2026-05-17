package keeper

import (
	"context"

	"localchain/x/records/types"

	errorsmod "cosmossdk.io/errors"
	sdk "github.com/cosmos/cosmos-sdk/types"
)

func (k msgServer) CreateRecord(ctx context.Context, msg *types.MsgCreateRecord) (*types.MsgCreateRecordResponse, error) {
	if _, err := k.addressCodec.StringToBytes(msg.Creator); err != nil {
		return nil, errorsmod.Wrap(err, "invalid creator address")
	}

	// Generate next record ID
	recordID, err := k.NextRecordID(ctx)
	if err != nil {
		return nil, errorsmod.Wrap(err, "failed to generate record ID")
	}

	// Create the record
	record := types.NewRecord(recordID, msg, sdk.UnwrapSDKContext(ctx).BlockTime().Unix())

	// Validate the record before storing
	if err := record.Validate(); err != nil {
		return nil, errorsmod.Wrap(err, "invalid record")
	}

	// Store the record
	if err := k.Records.Set(ctx, recordID, record); err != nil {
		return nil, errorsmod.Wrap(err, "failed to store record")
	}

	return &types.MsgCreateRecordResponse{
		RecordId: recordID,
	}, nil
}
