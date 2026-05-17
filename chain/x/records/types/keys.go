package types

import "cosmossdk.io/collections"

const (
	ModuleName = "records"
	StoreKey   = ModuleName
	GovModuleName = "gov"
)

// Collection prefixes
var (
	ParamsKey    = collections.NewPrefix(0) // Params storage
	RecordKey    = collections.NewPrefix(1) // Record storage: uint64 -> Record
	RecordCountKey = collections.NewPrefix(2) // Auto-increment counter
)
