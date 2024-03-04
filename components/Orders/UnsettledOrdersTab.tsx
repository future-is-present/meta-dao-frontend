import { useCallback, useMemo, useState } from 'react';
import { Stack, Table, Button, Group, Text } from '@mantine/core';
import { Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { useProposal } from '@/contexts/ProposalContext';
import { isClosableOpenOrdersAccount, isPartiallyFilled } from '@/lib/openbook';
import { UnsettledOrderRow } from './UnsettledOrderRow';
import { useBalances } from '../../contexts/BalancesContext';

const headers = ['Order ID', 'Market', 'Claimable', 'Actions'];

export function UnsettledOrdersTab({
  openOrdersAccounts,
}: {
  openOrdersAccounts: OpenOrdersAccountWithKey[];
}) {
  const sender = useTransactionSender();
  const wallet = useWallet();
  const { proposal, markets, fetchOpenOrdersAccounts } = useProposal();
  const { fetchBalance } = useBalances();
  const { settleFundsTransactions, closeOpenOrdersAccountTransactions } = useOpenbookTwap();

  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const ordersToSettle = useMemo(
    () => openOrdersAccounts.filter((order) => isPartiallyFilled(order)),
    [openOrdersAccounts],
  );
  const openOrdersAccountToClose = useMemo(() => {
    const possibleDuplicateOoa = openOrdersAccounts.filter((order) =>
      isClosableOpenOrdersAccount(order),
    );
    return [...new Set(possibleDuplicateOoa)];
  }, [openOrdersAccounts]);

  const handleSettleAllFunds = useCallback(async () => {
    if (!proposal || !markets || !wallet?.publicKey) return;

    setIsSettling(true);
    try {
      const txs = (
        await Promise.all(
          ordersToSettle.map((order) => {
            const pass = order.account.market.equals(proposal.account.openbookPassMarket);
            return settleFundsTransactions(
              order.account.accountNum,
              pass,
              proposal,
              pass
                ? { account: markets.pass, publicKey: proposal.account.openbookPassMarket }
                : { account: markets.fail, publicKey: proposal.account.openbookFailMarket },
            );
          }),
        )
      )
        .flat()
        .filter(Boolean);

      if (!txs) return;
      await sender.send(txs as Transaction[]);
      fetchOpenOrdersAccounts(wallet.publicKey);
      fetchBalance(markets.pass.baseMint);
      fetchBalance(markets.pass.quoteMint);
      fetchBalance(markets.fail.baseMint);
      fetchBalance(markets.fail.quoteMint);
    } finally {
      setIsSettling(false);
    }
  }, [
    ordersToSettle,
    markets,
    proposal,
    sender,
    settleFundsTransactions,
    fetchOpenOrdersAccounts,
    fetchBalance,
  ]);

  const handleCloseAllOrders = useCallback(async () => {
    if (!proposal || !markets || !wallet?.publicKey) return;

    setIsClosing(true);

    try {
      const txs = (
        await Promise.all(
          openOrdersAccountToClose.map((order) =>
            closeOpenOrdersAccountTransactions(new BN(order.account.accountNum)),
          ),
        )
      )
        .flat()
        .filter(Boolean);

      if (!txs) return;
      await sender.send(txs as Transaction[]);
    } finally {
      fetchOpenOrdersAccounts(wallet.publicKey);
      setIsClosing(false);
    }
  }, [
    openOrdersAccountToClose,
    markets,
    proposal,
    sender,
    settleFundsTransactions,
    fetchOpenOrdersAccounts,
  ]);

  const handleCloseAllOpenOrdersAccountsExceptOne = useCallback(async () => {
    if (!proposal || !markets || !wallet?.publicKey) return;

    setIsClosing(true);

    try {
      // Remove the first element to we leave one open openOrdersAccounts account open for future trades in this market
      openOrdersAccountToClose.shift();
      const txs = (
        await Promise.all(
          openOrdersAccountToClose.map((order) =>
            closeOpenOrdersAccountTransactions(new BN(order.account.accountNum)),
          ),
        )
      )
        .flat()
        .filter(Boolean);

      if (!txs) return;
      await sender.send(txs as Transaction[]);
    } finally {
      fetchOpenOrdersAccounts(wallet.publicKey);
      setIsClosing(false);
    }
  }, [
    openOrdersAccountToClose,
    markets,
    proposal,
    sender,
    settleFundsTransactions,
    fetchOpenOrdersAccounts,
  ]);

  return (
    <Stack py="md">
      <Text size="sm">
        These are your Open Order Accounts (OpenBook uses a{' '}
        <a
          href="https://twitter.com/openbookdex/status/1727309884159299929?s=61&t=Wv1hCdAly84RMB_iLO0iIQ"
          target="_blank"
          rel="noreferrer"
        >
          crank
        </a>{' '}
        and to do that when you place an order you create an account that store openOrdersAccounts).
        If you see a balance here you can settle the balance (to have it returned to your wallet for
        further use while the proposal is active). Once settled and the proposal is finished, you
        can close the open openOrdersAccounts account to reclaim the SOL.
      </Text>
      <Group>
        <Button
          variant="outline"
          loading={isSettling}
          onClick={handleSettleAllFunds}
          disabled={ordersToSettle.length === 0}
        >
          Settle {ordersToSettle.length} Orders
        </Button>

        <Button // TODO: Binye this is a hack for now, get rid of this once all ooa have been closed
          variant="outline"
          loading={isClosing}
          onClick={handleCloseAllOpenOrdersAccountsExceptOne}
          disabled={openOrdersAccountToClose.length < 2}
        >
          Close unnecessary Open Orders Accounts
        </Button>
      </Group>
      {openOrdersAccounts && openOrdersAccounts.length > 0 ? (
        <Table>
          <Table.Thead>
            <Table.Tr>
              {headers.map((header) => (
                <Table.Th key={header}>{header}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {openOrdersAccounts.map((order) => (
              <UnsettledOrderRow key={order.publicKey.toString()} order={order} />
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text py="sm">No Orders Found</Text>
      )}
    </Stack>
  );
}
