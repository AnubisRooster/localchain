package keeper

import (
	"context"

	"localchain/x/records/types"

	errorsmod "cosmossdk.io/errors"
)

func (k msgServer) CreateRecord(ctx context.Context, msg *types.MsgCreateRecord) (*types.MsgCreateRecordResponse, error) {
	if _, err := k.addressCodec.StringToBytes(msg.Creator); err != nil {
		return nil, errorsmod.Wrap(err, "invalid authority address")
	}

	// TODO: Handle the message

	return &types.MsgCreateRecordResponse{}, nil
}
