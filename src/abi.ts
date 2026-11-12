// Generated from verified Etherscan/Blockscout ABIs (filtered to the functions this CLI uses).

export const midnightAbi = [
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "index",
        type: "uint256",
      },
    ],
    name: "collateral",
    outputs: [
      {
        internalType: "uint128",
        name: "",
        type: "uint128",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "authorizer",
        type: "address",
      },
      {
        internalType: "address",
        name: "authorized",
        type: "address",
      },
    ],
    name: "isAuthorized",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "chainId",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "midnight",
            type: "address",
          },
          {
            internalType: "address",
            name: "loanToken",
            type: "address",
          },
          {
            components: [
              {
                internalType: "address",
                name: "token",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "lltv",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "liquidationCursor",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "oracle",
                type: "address",
              },
            ],
            internalType: "struct CollateralParams[]",
            name: "collateralParams",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "maturity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "rcfThreshold",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "enterGate",
            type: "address",
          },
          {
            internalType: "address",
            name: "liquidatorGate",
            type: "address",
          },
        ],
        internalType: "struct Market",
        name: "market",
        type: "tuple",
      },
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "borrower",
        type: "address",
      },
    ],
    name: "isHealthy",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
    ],
    name: "marketState",
    outputs: [
      {
        internalType: "uint128",
        name: "totalUnits",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "lossFactor",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "withdrawable",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "continuousFeeCredit",
        type: "uint128",
      },
      {
        internalType: "uint16",
        name: "settlementFeeCbp0",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "settlementFeeCbp1",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "settlementFeeCbp2",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "settlementFeeCbp3",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "settlementFeeCbp4",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "settlementFeeCbp5",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "settlementFeeCbp6",
        type: "uint16",
      },
      {
        internalType: "uint32",
        name: "continuousFee",
        type: "uint32",
      },
      {
        internalType: "uint8",
        name: "tickSpacing",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "position",
    outputs: [
      {
        internalType: "uint128",
        name: "credit",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "pendingFee",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "lastLossFactor",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "lastAccrual",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "debt",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "collateralBitmap",
        type: "uint128",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "authorized",
        type: "address",
      },
      {
        internalType: "bool",
        name: "newIsAuthorized",
        type: "bool",
      },
      {
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
    ],
    name: "setIsAuthorized",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "timeToMaturity",
        type: "uint256",
      },
    ],
    name: "settlementFee",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "chainId",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "midnight",
            type: "address",
          },
          {
            internalType: "address",
            name: "loanToken",
            type: "address",
          },
          {
            components: [
              {
                internalType: "address",
                name: "token",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "lltv",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "liquidationCursor",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "oracle",
                type: "address",
              },
            ],
            internalType: "struct CollateralParams[]",
            name: "collateralParams",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "maturity",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "rcfThreshold",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "enterGate",
            type: "address",
          },
          {
            internalType: "address",
            name: "liquidatorGate",
            type: "address",
          },
        ],
        internalType: "struct Market",
        name: "market",
        type: "tuple",
      },
      {
        internalType: "uint256",
        name: "collateralIndex",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
    ],
    name: "supplyCollateral",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            components: [
              {
                internalType: "uint256",
                name: "chainId",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "midnight",
                type: "address",
              },
              {
                internalType: "address",
                name: "loanToken",
                type: "address",
              },
              {
                components: [
                  {
                    internalType: "address",
                    name: "token",
                    type: "address",
                  },
                  {
                    internalType: "uint256",
                    name: "lltv",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "liquidationCursor",
                    type: "uint256",
                  },
                  {
                    internalType: "address",
                    name: "oracle",
                    type: "address",
                  },
                ],
                internalType: "struct CollateralParams[]",
                name: "collateralParams",
                type: "tuple[]",
              },
              {
                internalType: "uint256",
                name: "maturity",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "rcfThreshold",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "enterGate",
                type: "address",
              },
              {
                internalType: "address",
                name: "liquidatorGate",
                type: "address",
              },
            ],
            internalType: "struct Market",
            name: "market",
            type: "tuple",
          },
          {
            internalType: "bool",
            name: "buy",
            type: "bool",
          },
          {
            internalType: "address",
            name: "maker",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "start",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "expiry",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "tick",
            type: "uint256",
          },
          {
            internalType: "bytes32",
            name: "group",
            type: "bytes32",
          },
          {
            internalType: "address",
            name: "callback",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "callbackData",
            type: "bytes",
          },
          {
            internalType: "address",
            name: "receiverIfMakerIsSeller",
            type: "address",
          },
          {
            internalType: "address",
            name: "ratifier",
            type: "address",
          },
          {
            internalType: "bool",
            name: "reduceOnly",
            type: "bool",
          },
          {
            internalType: "uint128",
            name: "maxUnits",
            type: "uint128",
          },
          {
            internalType: "uint128",
            name: "maxAssets",
            type: "uint128",
          },
          {
            internalType: "uint256",
            name: "continuousFeeCap",
            type: "uint256",
          },
        ],
        internalType: "struct Offer",
        name: "offer",
        type: "tuple",
      },
      {
        internalType: "bytes",
        name: "ratifierData",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "units",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "taker",
        type: "address",
      },
      {
        internalType: "address",
        name: "receiverIfTakerIsSeller",
        type: "address",
      },
      {
        internalType: "address",
        name: "takerCallback",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "takerCallbackData",
        type: "bytes",
      },
    ],
    name: "take",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
    ],
    name: "tickSpacing",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "AlreadyConsumed",
    type: "error",
  },
  {
    inputs: [],
    name: "BuyerGatedFromIncreasingCredit",
    type: "error",
  },
  {
    inputs: [],
    name: "CannotIncreaseDebtPostMaturity",
    type: "error",
  },
  {
    inputs: [],
    name: "CastOverflow",
    type: "error",
  },
  {
    inputs: [],
    name: "CollateralParamsNotSorted",
    type: "error",
  },
  {
    inputs: [],
    name: "ConsumedAssets",
    type: "error",
  },
  {
    inputs: [],
    name: "ConsumedUnits",
    type: "error",
  },
  {
    inputs: [],
    name: "ContinuousFeeAboveMax",
    type: "error",
  },
  {
    inputs: [],
    name: "ContinuousFeeAboveOfferCap",
    type: "error",
  },
  {
    inputs: [],
    name: "FeeNotMultipleOfFeeCbp",
    type: "error",
  },
  {
    inputs: [],
    name: "InconsistentInput",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidChainId",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidFeeIndex",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidLiquidationCursor",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidLltv",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidMaxLif",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidMidnight",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidOfferCaps",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidTickSpacing",
    type: "error",
  },
  {
    inputs: [],
    name: "LiquidationCursorNotEnabled",
    type: "error",
  },
  {
    inputs: [],
    name: "LiquidatorGatedFromLiquidating",
    type: "error",
  },
  {
    inputs: [],
    name: "LltvNotEnabled",
    type: "error",
  },
  {
    inputs: [],
    name: "MakerCreditOrDebtIncreased",
    type: "error",
  },
  {
    inputs: [],
    name: "MarketLossFactorMaxedOut",
    type: "error",
  },
  {
    inputs: [],
    name: "MarketNotCreated",
    type: "error",
  },
  {
    inputs: [],
    name: "MaturityTooFar",
    type: "error",
  },
  {
    inputs: [],
    name: "MaxLifTooHigh",
    type: "error",
  },
  {
    inputs: [],
    name: "NoCode",
    type: "error",
  },
  {
    inputs: [],
    name: "NoCollateralParams",
    type: "error",
  },
  {
    inputs: [],
    name: "NotBorrower",
    type: "error",
  },
  {
    inputs: [],
    name: "NotLiquidatable",
    type: "error",
  },
  {
    inputs: [],
    name: "OfferExpired",
    type: "error",
  },
  {
    inputs: [],
    name: "OfferNotStarted",
    type: "error",
  },
  {
    inputs: [],
    name: "OnlyConfigurator",
    type: "error",
  },
  {
    inputs: [],
    name: "OnlyFeeClaimer",
    type: "error",
  },
  {
    inputs: [],
    name: "OnlyFeeSetter",
    type: "error",
  },
  {
    inputs: [],
    name: "OnlyTickSpacingSetter",
    type: "error",
  },
  {
    inputs: [],
    name: "RatifierFailed",
    type: "error",
  },
  {
    inputs: [],
    name: "RatifierUnauthorized",
    type: "error",
  },
  {
    inputs: [],
    name: "RecoveryCloseFactorConditionsViolated",
    type: "error",
  },
  {
    inputs: [],
    name: "SStore2DeploymentFailed",
    type: "error",
  },
  {
    inputs: [],
    name: "SelfTake",
    type: "error",
  },
  {
    inputs: [],
    name: "SellerGatedFromIncreasingDebt",
    type: "error",
  },
  {
    inputs: [],
    name: "SellerIsLiquidatable",
    type: "error",
  },
  {
    inputs: [],
    name: "SettlementFeeAboveMax",
    type: "error",
  },
  {
    inputs: [],
    name: "TakerUnauthorized",
    type: "error",
  },
  {
    inputs: [],
    name: "TickNotAccessible",
    type: "error",
  },
  {
    inputs: [],
    name: "TickOutOfRange",
    type: "error",
  },
  {
    inputs: [],
    name: "TooManyActivatedCollaterals",
    type: "error",
  },
  {
    inputs: [],
    name: "TooManyCollateralParams",
    type: "error",
  },
  {
    inputs: [],
    name: "TransferFromReturnedFalse",
    type: "error",
  },
  {
    inputs: [],
    name: "TransferReturnedFalse",
    type: "error",
  },
  {
    inputs: [],
    name: "Unauthorized",
    type: "error",
  },
  {
    inputs: [],
    name: "UnhealthyBorrower",
    type: "error",
  },
  {
    inputs: [],
    name: "UnusedReceiverMustBeZero",
    type: "error",
  },
  {
    inputs: [],
    name: "WrongBuyCallbackReturnValue",
    type: "error",
  },
  {
    inputs: [],
    name: "WrongFlashLoanCallbackReturnValue",
    type: "error",
  },
  {
    inputs: [],
    name: "WrongLiquidateCallbackReturnValue",
    type: "error",
  },
  {
    inputs: [],
    name: "WrongRepayCallbackReturnValue",
    type: "error",
  },
  {
    inputs: [],
    name: "WrongSellCallbackReturnValue",
    type: "error",
  },
] as const;

export const blueAbi = [
  {
    inputs: [
      {
        internalType: "Id",
        name: "",
        type: "bytes32",
      },
    ],
    name: "idToMarketParams",
    outputs: [
      {
        internalType: "address",
        name: "loanToken",
        type: "address",
      },
      {
        internalType: "address",
        name: "collateralToken",
        type: "address",
      },
      {
        internalType: "address",
        name: "oracle",
        type: "address",
      },
      {
        internalType: "address",
        name: "irm",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "lltv",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "isAuthorized",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "Id",
        name: "",
        type: "bytes32",
      },
    ],
    name: "market",
    outputs: [
      {
        internalType: "uint128",
        name: "totalSupplyAssets",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "totalSupplyShares",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "totalBorrowAssets",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "totalBorrowShares",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "lastUpdate",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "fee",
        type: "uint128",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "Id",
        name: "",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "position",
    outputs: [
      {
        internalType: "uint256",
        name: "supplyShares",
        type: "uint256",
      },
      {
        internalType: "uint128",
        name: "borrowShares",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "collateral",
        type: "uint128",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "loanToken",
            type: "address",
          },
          {
            internalType: "address",
            name: "collateralToken",
            type: "address",
          },
          {
            internalType: "address",
            name: "oracle",
            type: "address",
          },
          {
            internalType: "address",
            name: "irm",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "lltv",
            type: "uint256",
          },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
      {
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "shares",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "repay",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "authorized",
        type: "address",
      },
      {
        internalType: "bool",
        name: "newIsAuthorized",
        type: "bool",
      },
    ],
    name: "setAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "loanToken",
            type: "address",
          },
          {
            internalType: "address",
            name: "collateralToken",
            type: "address",
          },
          {
            internalType: "address",
            name: "oracle",
            type: "address",
          },
          {
            internalType: "address",
            name: "irm",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "lltv",
            type: "uint256",
          },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
      {
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
    ],
    name: "withdrawCollateral",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const callbackAbi = [
  {
    inputs: [],
    name: "MORPHO_BLUE",
    outputs: [
      {
        internalType: "contract IMorpho",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MORPHO_MIDNIGHT",
    outputs: [
      {
        internalType: "contract IMidnight",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "ExcessRepayment",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidFeeConfig",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidReceiver",
    type: "error",
  },
  {
    inputs: [],
    name: "NoCode",
    type: "error",
  },
  {
    inputs: [],
    name: "OnlyMidnight",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
    ],
    name: "SafeERC20FailedOperation",
    type: "error",
  },
  {
    inputs: [],
    name: "TickOutOfRange",
    type: "error",
  },
  {
    inputs: [],
    name: "TokenMismatch",
    type: "error",
  },
  {
    inputs: [],
    name: "TransferReturnedFalse",
    type: "error",
  },
  {
    inputs: [],
    name: "ZeroAmount",
    type: "error",
  },
] as const;

export const erc20Abi = [
  {
    constant: false,
    inputs: [
      {
        name: "_spender",
        type: "address",
      },
      {
        name: "_value",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        name: "_owner",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        name: "_owner",
        type: "address",
      },
      {
        name: "_spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
] as const;

export const oracleAbi = [
  {
    inputs: [],
    name: "price",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
