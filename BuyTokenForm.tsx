import {AssetInput, AssetInputData} from '@/components/common/input/AssetInput';
import {CardHeading} from '@/components/common/layout/CardHeading';
import {PRIMARY_CHAIN} from '@/util/chains';
import {useKEIConnect} from '@kei.fi/connect';
import {BaseCard, KEIIcon, TokenInfo, useTokenList} from '@kei.fi/core-ui';
import {Box, Button, Divider, Stack, Typography, useTheme} from '@mui/material';
import {formatEther, formatUnits, parseUnits} from 'ethers';
import {useTranslations} from 'next-intl';
import {useCallback, useEffect, useMemo} from 'react';
import {FormContainer, useForm} from 'react-hook-form-mui';
import {useSquidRoute} from '@/hooks/useSquidRoute';
import {useSquidExecute} from '@/hooks/useSquidExecute';
import {useDebounce} from 'react-use';
import {FeeCost, GasCost, RouteResponse} from '@0xsquid/squid-types';
import {useQueryClient} from '@tanstack/react-query';
import deployments from '@kei.fi/token-contracts/deployments.json';
import {BuyTokenConfirmationModal} from './BuyTokenConfirmationModal';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import {formatToThreeSignificantDigits} from '@/util/formatToThreeSignificantDigits';
import {ChevronLoader} from '../../../common/loader/ChevronLoader';
import {useWert} from '@/hooks/useWert';
import {useTokenInfo} from '@/hooks/useTokenInfo';

interface BuyFormData {
  input?: AssetInputData;
  output?: AssetInputData;
}

const defaultBuyToken = 'KEI finance';

const disabledAssets = {
  [deployments[PRIMARY_CHAIN].KEITokenL2 ??
  (deployments[PRIMARY_CHAIN] as any).KEIToken]: true,
};

export const BuyTokenForm = () => {
  const theme = useTheme();
  const t = useTranslations();
  const {signer} = useKEIConnect();
  const squidRouteMutation = useSquidRoute(['buy', 'kei']);
  const squidExecuteMutation = useSquidExecute(['buy', 'kei']);
  const queryClient = useQueryClient();
  const wert = useWert();
  const {data: usdcInfo} = useTokenInfo('USDC');

  console.log({usdcInfo});

  //
  const {tokens} = useTokenList();
  const form = useForm<BuyFormData>({
    defaultValues: {
      input: {
        token: undefined,
        amount: undefined,
      },
      output: {
        token: tokens.find(t => t.name === defaultBuyToken),
        amount: undefined,
      },
    },
  });

  const [input, output] = form.watch(['input', 'output']);

  const outputToken = output?.token as TokenInfo | undefined;
  const inputToken = input?.token;

  // Convert the amount to the correct number of decimals
  const fromAmount = useMemo(() => {
    const amount = Number(input?.amount ?? 0);
    if (!amount || !usdcInfo || !inputToken) return 0n;
    const decimals =
      inputToken === 'CARD'
        ? usdcInfo.detail_platforms['arbitrum-one'].decimal_place
        : inputToken.decimals;
    return parseUnits(amount + '', decimals);
  }, [input?.amount, inputToken, usdcInfo]);

  const onSubmit = async (buyFormData: BuyFormData) => {
    if (
      fromAmount === 0n ||
      !signer ||
      !buyFormData.input?.amount ||
      !buyFormData.output ||
      !squidRouteMutation.data ||
      (inputToken !== 'CARD' && inputToken?.name === outputToken?.name)
    ) {
      console.error('Missing required data for transaction');
      return;
    }
    try {
      if (inputToken === 'CARD') {
        const transactionRequest =
          squidRouteMutation.data.route.transactionRequest;

        if (transactionRequest) {
          await wert.purchase({
            amount: +buyFormData.input.amount,
            commodity: 'USDC',
            chainId: PRIMARY_CHAIN,
            contract: transactionRequest.target,
            data: transactionRequest.data,
          });
        }
      } else {
        const mutateResult = await squidExecuteMutation.mutateAsync(
          squidRouteMutation.data as RouteResponse
        );

        await mutateResult.wait();

        // refetch balances
        await queryClient.invalidateQueries({
          queryKey: ['balanceOf'],
        });
      }
    } catch (error: any) {
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      throw error;
    }
  };

  useEffect(() => {
    form.resetField('input.amount');
  }, [inputToken]);

  const fetchSquidRoute = useCallback(() => {
    if (
      !signer?.address ||
      !outputToken?.address ||
      !inputToken ||
      !usdcInfo ||
      fromAmount === 0n
    ) {
      squidRouteMutation.reset();
      form.resetField('output.amount');
      return;
    }

    squidRouteMutation.mutate({
      fromToken:
        inputToken === 'CARD'
          ? usdcInfo.detail_platforms['arbitrum-one'].contract_address
          : inputToken.address,
      fromAmount: fromAmount + '',
      fromAddress: signer.address,
      toToken: outputToken.address,
      toChain: PRIMARY_CHAIN + '',
      toAddress: signer.address,
      slippage: 1, // 1% slippage, adjust as needed
      enableBoost: true,
    });
  }, [signer, outputToken?.address, inputToken, fromAmount]);

  useDebounce(fetchSquidRoute, 500, [fetchSquidRoute]);

  useEffect(() => {
    const toAmount = squidRouteMutation.data?.route?.estimate?.toAmount;
    if (!toAmount || !outputToken?.decimals) {
      return;
    }

    form.setValue(
      'output.amount',
      +formatUnits(toAmount, outputToken?.decimals)
    );
  }, [
    squidRouteMutation?.data?.route?.estimate?.toAmount,
    outputToken?.decimals,
    form.setValue,
  ]);

  const displayedOutputAmount = useMemo(() => {
    const outputAmount = output?.amount;
    if (!outputAmount) {
      return null;
    }
    return formatToThreeSignificantDigits(Number(outputAmount));
  }, [output?.amount]);

  const displayedTotalFeeAmount = useMemo(() => {
    const gasCosts: GasCost[] =
      squidRouteMutation?.data?.route?.estimate?.gasCosts ?? [];
    const feeCost: FeeCost[] =
      squidRouteMutation?.data?.route?.estimate?.feeCosts ?? [];
    if (gasCosts.length === 0 && feeCost.length === 0) {
      return '0';
    }
    const countAmount = (total: bigint, record: {amount: string}) =>
      total + BigInt(record.amount);
    const totalGasCost = gasCosts.reduce(countAmount, 0n);
    const totalFeeCost = feeCost.reduce(countAmount, 0n);
    return formatToThreeSignificantDigits(
      +formatEther(totalGasCost + totalFeeCost)
    );
  }, [
    squidRouteMutation?.data?.route?.estimate?.gasCosts,
    squidRouteMutation?.data?.route?.estimate?.feeCosts,
  ]);

  return (
    <FormContainer<BuyFormData> onSuccess={onSubmit} formContext={form}>
      <BaseCard p={4} flexBasis="40rem" spacing={3}>
        <CardHeading title="common.buy" />
        <Box position="relative">
          <AssetInput
            name="input"
            isActive={true}
            hiddenAssets={disabledAssets}
            isLoading={squidRouteMutation.isPending}
          />
        </Box>
        <ChevronLoader isVertical={true} />
        <Stack alignItems="center">
          <Typography fontSize="1.125rem" textAlign="center">
            Total
          </Typography>
          <Typography
            fontWeight="600"
            fontSize="64px"
            lineHeight="64px"
            display="flex"
            alignItems="center"
            gap={1}
          >
            {displayedOutputAmount}
          </Typography>
          &nbsp;
          <KEIIcon height="2.5rem" width="2.5rem" p={1} />
        </Stack>
        <Box px={2}>
          <Divider sx={{borderColor: theme.palette.grey[300]}} />
        </Box>
        <Box px={2}>
          <Box display="flex" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" fontWeight="medium">
                {t('common.gas-fee')}
              </Typography>
              <LocalGasStationIcon
                sx={{color: theme.palette.grey[900], fontSize: 16}}
              />
            </Box>
            <Typography variant="body2" sx={{fontWeight: 'medium'}}>
              {displayedTotalFeeAmount} ETH
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          sx={{
            width: '10rem',
            alignSelf: 'center',
            borderRadius: '100px',
          }}
          type="submit"
          disabled={
            !squidRouteMutation.data ||
            +(input?.amount ?? '0') <= 0 ||
            squidExecuteMutation.isPending ||
            wert.isPurchasing
          }
        >
          {t('common.confirm')}
        </Button>
      </BaseCard>
      <BuyTokenConfirmationModal mutation={squidExecuteMutation} />
    </FormContainer>
  );
};
