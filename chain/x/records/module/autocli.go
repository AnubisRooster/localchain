package records

import (
	autocliv1 "cosmossdk.io/api/cosmos/autocli/v1"

	"localchain/x/records/types"
)

// AutoCLIOptions implements the autocli.HasAutoCLIConfig interface.
func (am AppModule) AutoCLIOptions() *autocliv1.ModuleOptions {
	return &autocliv1.ModuleOptions{
		Query: &autocliv1.ServiceCommandDescriptor{
			Service: types.Query_serviceDesc.ServiceName,
			RpcCommandOptions: []*autocliv1.RpcCommandOptions{
				{
					RpcMethod: "Params",
					Use:       "params",
					Short:     "Shows the parameters of the module",
				},
				{
					RpcMethod:      "ListRecords",
					Use:            "list-records ",
					Short:          "Query list-records",
					PositionalArgs: []*autocliv1.PositionalArgDescriptor{},
				},
			},
		},
		Tx: &autocliv1.ServiceCommandDescriptor{
			Service:              types.Msg_serviceDesc.ServiceName,
			EnhanceCustomCommand: true, // only required if you want to use the custom command
			RpcCommandOptions: []*autocliv1.RpcCommandOptions{
				{
					RpcMethod: "UpdateParams",
					Skip:      true, // skipped because authority gated
				},
				{
					RpcMethod:      "CreateRecord",
					Use:            "create-record [data]",
					Short:          "Send a create-record tx",
					PositionalArgs: []*autocliv1.PositionalArgDescriptor{{ProtoField: "data"}},
				},
			},
		},
	}
}
