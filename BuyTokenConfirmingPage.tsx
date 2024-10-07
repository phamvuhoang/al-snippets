import React from 'react';
import {
  TransactionModalStatus,
  useTransactionModalState,
} from '@/components/features/transaction-modal/TransactionModalProvider';
import {useWatch} from 'react-hook-form-mui';
import {Box, Typography} from '@mui/material';
import {useTranslations} from 'next-intl';
import {formatToThreeSignificantDigits} from '@/util/formatToThreeSignificantDigits';
import {TokenLogo, ViewTransactionButton} from '@kei.fi/core-ui';
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined';
import {TransactionModalLoader} from '@/components/features/transaction-modal';
import {TxRunTime} from '@/components/common/text/TxRunTime';

export const BuyTokenConfirmingPage = () => {
  const t = useTranslations();
  const {response} = useTransactionModalState();
  const {input, output} = useWatch();

  const fromAmount = input?.amount;
  const fromCurrency = input?.token?.symbol;
  const toCurrency = output?.token?.symbol;
  const toAmount = output?.amount;
  const txHash = response?.hash ?? '';
  const chainId = output?.token?.chainId;
  const toAmountUSD = output?.cost ?? input?.cost;

  return (
    <Box sx={{textAlign: 'center'}}>
      <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
        <TransactionModalLoader status={TransactionModalStatus.Confirming} />
      </Box>

      <Typography
        variant="h4"
        sx={{mb: 2, lineHeight: '24px', fontWeight: 500}}
      >
        {t('common.confirming')}...
      </Typography>
      <TxRunTime />

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          p: 3,
          boxShadow: '0px 1px 30px 0px #1018280D',
          borderRadius: 4,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Box sx={{display: 'flex', alignItems: 'center'}}>
            <TokenLogo token={input?.token} />
          </Box>
          <Box sx={{display: 'flex', alignItems: 'baseline', gap: 1}}>
            <Typography variant="h4" sx={{lineHeight: '24px', fontWeight: 400}}>
              {fromAmount}
            </Typography>
            <Typography
              variant="body2"
              sx={{color: '#0B0B0B', lineHeight: '16px', fontWeight: 400}}
            >
              {fromCurrency}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowDownwardOutlinedIcon
            sx={{color: '#F328A5', fontSize: '24px'}}
          />
        </Box>
        <Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 1,
            }}
          >
            <Box sx={{display: 'flex', alignItems: 'center'}}>
              <TokenLogo token={output?.token} />
            </Box>
            <Box sx={{display: 'flex', alignItems: 'baseline', gap: 1}}>
              <Typography
                variant="h1"
                sx={{lineHeight: '40px', fontWeight: 400}}
              >
                {formatToThreeSignificantDigits(toAmount)}
              </Typography>
              <Typography
                variant="body1"
                sx={{color: '#0B0B0B', lineHeight: '24px', fontSize: '24px'}}
              >
                {toCurrency}
              </Typography>
            </Box>
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{mt: 0.5, fontWeight: 500}}
          >
            ${formatToThreeSignificantDigits(toAmountUSD)}
          </Typography>
        </Box>
      </Box>
      {!!txHash && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 2,
            pl: 2,
            pr: 2,
          }}
        >
          <Typography variant="body2" sx={{fontWeight: 700}}>
            {t('common.tx')}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <ViewTransactionButton tx={txHash} chainId={chainId} />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default BuyTokenConfirmingPage;
