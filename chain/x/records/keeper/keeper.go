package keeper

import (
	"context"
	"fmt"

	"cosmossdk.io/collections"
	"cosmossdk.io/core/address"
	corestore "cosmossdk.io/core/store"
	"github.com/cosmos/cosmos-sdk/codec"

	"localchain/x/records/types"
)

type Keeper struct {
	storeService corestore.KVStoreService
	cdc          codec.Codec
	addressCodec address.Codec
	// Address capable of executing a MsgUpdateParams message.
	// Typically, this should be the x/gov module account.
	authority []byte

	Schema collections.Schema
	Params collections.Item[types.Params]

	// Records stores all records indexed by ID
	Records collections.Map[uint64, types.Record]
	// RecordCount is an auto-incrementing sequence for record IDs
	RecordCount collections.Sequence
}

func NewKeeper(
	storeService corestore.KVStoreService,
	cdc codec.Codec,
	addressCodec address.Codec,
	authority []byte,

) Keeper {
	if _, err := addressCodec.BytesToString(authority); err != nil {
		panic(fmt.Sprintf("invalid authority address %s: %s", authority, err))
	}

	sb := collections.NewSchemaBuilder(storeService)

	k := Keeper{
		storeService: storeService,
		cdc:          cdc,
		addressCodec: addressCodec,
		authority:    authority,

		Params:      collections.NewItem(sb, types.ParamsKey, "params", codec.CollValue[types.Params](cdc)),
		Records:     collections.NewMap(sb, types.RecordKey, "records", collections.Uint64Key, RecordValueCodec{}),
		RecordCount: collections.NewSequence(sb, types.RecordCountKey, "record_count"),
	}

	schema, err := sb.Build()
	if err != nil {
		panic(err)
	}
	k.Schema = schema

	return k
}

// GetAuthority returns the module's authority.
func (k Keeper) GetAuthority() []byte {
	return k.authority
}

// NextRecordID generates and returns the next record ID
func (k Keeper) NextRecordID(ctx context.Context) (uint64, error) {
	return k.RecordCount.Next(ctx)
}
