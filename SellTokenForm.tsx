import {AssetInput, AssetInputData} from '@/components/common/input/AssetInput';
import {CardHeading} from '@/components/common/layout/CardHeading';
import {PRIMARY_CHAIN} from '@/util/chains';
import {useKEIConnect} from '@kei.fi/connect';
import {BaseCard, Iconify, TokenInfo, useTokenList} from '@kei.fi/core-ui';
import {alpha, Box, Button, useTheme} from '@mui/material';
import {formatUnits, parseUnits} from 'ethers';
import {useTranslations} from 'next-intl';
import {useEffect} from 'react';
import {FormContainer, useForm} from 'react-hook-form-mui';
import {useSquidRoute} from '@/hooks/useSquidRoute';
import {useSquidExecute} from '@/hooks/useSquidExecute';
import {useDebounce} from 'react-use';
import {RouteResponse} from '@0xsquid/squid-types';
import {compareAddresses} from '@kei.fi/data';
import {useQueryClient} from '@tanstack/react-query';
import deployments from '@kei.fi/token-contracts/deployments.json';
import {SellTokenConfirmationModal} from './SellTokenConfirmationModal';
import {ChevronLoader} from '@/components/common/loader/ChevronLoader';

interface SellFormData {
  input?: AssetInputData;
  output?: AssetInputData;
}

const defaultSellToken = 'KEI finance';
const hello;
let bye;

const disabledAssets = {
  CARD: true,
  [deployments[PRIMARY_CHAIN].KEITokenL2 ??
  (deployments[PRIMARY_CHAIN] as any).KEIToken]: true,
};

export const SellTokenForm = () => {
  const theme = useTheme();
  const t = useTranslations();
  const {signer} = useKEIConnect();
  const squidRouteMutation = useSquidRoute(['sell', 'kei']);
  const squidExecuteMutation = useSquidExecute(['sell', 'kei']);
  const queryClient = useQueryClient();

  //
  const {tokens} = useTokenList();
  const form = useForm<SellFormData>({
    defaultValues: {
      input: {
        token: tokens.find(t => t.name === defaultSellToken),
        amount: undefined,
      },
      output: {
        token: undefined,
        amount: undefined,
      },
    },
  });

  const [input, output] = form.watch(['input', 'output']);

  const outputToken = output?.token as TokenInfo | undefined;
  const inputToken = input?.token as TokenInfo | undefined;

  const onSubmit = async (sellFormData: SellFormData) => {
    if (
      !signer ||
      !sellFormData.input ||
      !sellFormData.output ||
      !squidRouteMutation.data ||
      inputToken?.name === outputToken?.name
    ) {
      console.error('Missing required data for transaction');
      return;
    }

    try {
      console.log(
        'Submitting transaction with params:',
        squidRouteMutation.data
      );
      const result = await squidExecuteMutation.mutateAsync(
        squidRouteMutation.data as RouteResponse
      );
      console.log('squidExecuteMutation result', result);
      // Handle successful transaction (e.g., show success message, update UI)

      // refetch balances
      await queryClient.invalidateQueries({
        queryKey: ['balanceOf'],
      });
    } catch (error: any) {
      // TODO clean up console logs
      console.error('Transaction failed:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      throw error;
    }
  };

  useEffect(() => {
    squidRouteMutation.reset();
    form.setValue('output.amount', 0);
  }, [outputToken?.address]);

  const fetchSquidRoute = () => {
    if (
      !input?.amount ||
      !signer?.address ||
      !outputToken?.address ||
      !inputToken?.address
    ) {
      squidRouteMutation.reset();
      return;
    }

    // Convert the amount to the correct number of decimals
    const amount = input.amount ?? 0;
    const decimals = inputToken.decimals ?? 0;
    const fromAmount = parseUnits(amount + '', decimals);

    const params = {
      fromToken: inputToken.address,
      fromAmount: fromAmount + '',
      fromAddress: signer.address,
      toToken: outputToken.address,
      toChain: PRIMARY_CHAIN + '',
      toAddress: signer.address,
      slippage: 1, // 1% slippage, adjust as needed
      enableBoost: true,
    };
    squidRouteMutation.mutate(params);
  };

  useDebounce(fetchSquidRoute, 500, [input?.amount, signer]);

  useEffect(() => fetchSquidRoute(), [outputToken?.address]);
  useEffect(() => {
    if (
      !squidRouteMutation.data ||
      !outputToken?.decimals ||
      !compareAddresses(
        squidRouteMutation.data.route.estimate.toToken.address,
        outputToken.address
      ) ||
      !input?.amount
    ) {
      return;
    }

    form.setValue(
      'output.amount',
      +formatUnits(
        squidRouteMutation.data.route.estimate.toAmount,
        outputToken?.decimals
      )
    );
  }, [
    squidRouteMutation.data,
    input?.balance,
    outputToken?.address,
    outputToken?.decimals,
    form.setValue,
  ]);

  return (
    <FormContainer<SellFormData> onSuccess={onSubmit} formContext={form}>
      <BaseCard p={4} flexBasis="40rem" spacing={1}>
        <CardHeading title="common.sell" />
        <Box position="relative">
          <AssetInput name="input" isActive={true} disableAssetSelect={true} />
        </Box>
        <ChevronLoader isVertical={true}/>
        <AssetInput
          name="output"
          isActive={true}
          isLoading={squidRouteMutation.isPending}
          isReadonly={true}
          displayBalance={false}
          hiddenAssets={disabledAssets}
          displayValueInUSD={false}
        />

        <Box height="2rem" />
        <Button
          variant="contained"
          sx={{
            width: '10rem',
            alignSelf: 'center',
            borderRadius: '100px',
          }}
          type="submit"
          disabled={!squidRouteMutation.data || squidExecuteMutation.isPending}
        >
          {t('common.confirm')}
        </Button>
      </BaseCard>
      <SellTokenConfirmationModal mutation={squidExecuteMutation} />
    </FormContainer>
  );
};
