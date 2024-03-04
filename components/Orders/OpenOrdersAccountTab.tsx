import { useCallback, useState } from 'react';
import { Stack, Table, Button, Group, Text } from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { OpenOrder, OpenOrdersAccountWithKey } from '@/lib/types';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { useProposal } from '@/contexts/ProposalContext';
import { OpenOrderRow } from './OpenOrderRow';

const headers = ['Order ID', 'Market', 'Status', 'Size', 'Price', 'Notional', 'Actions'];

// TODO binye it assumes there are only two types of markets proposal.account.openbookPassMarket or proposal.account.openbookFailMarket so no need the PublicKey
export function OpenOrdersAccountTab({
  openOrdersAccounts,
  market,
}: {
  openOrdersAccounts: OpenOrdersAccountWithKey[];
  market: PublicKey;
}) {
  const { markets, isCranking, crankMarkets } = useProposal();
  const sender = useTransactionSender();
  const wallet = useWallet();
  const { fetchOpenOrdersAccounts, proposal } = useProposal();
  const { cancelOrderTransactions, settleFundsTransactions } = useOpenbookTwap();

  const [isCanceling, setIsCanceling] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const handleCancelAll = useCallback(async () => {
    if (!proposal || !markets) return;

    const txs = (
      await Promise.all(
        openOrdersAccounts.map((openOrdersAccount) => {
          openOrdersAccount.account.openOrders.map((order) =>
            cancelOrderTransactions(
              openOrdersAccount.publicKey,
              new BN(order.clientId),
              proposal.account.openbookPassMarket.equals(market)
                ? { publicKey: market, account: markets.pass }
                : { publicKey: market, account: markets.fail },
            ),
          );
        }),
      )
    ).flat();

    if (!wallet.publicKey || !txs) return;
    try {
      setIsCanceling(true);
      // Filtered undefined already
      await sender.send(txs);
      // We already return above if the wallet doesn't have a public key
      await fetchOpenOrdersAccounts(wallet.publicKey!);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCanceling(false);
    }
  }, [
    proposal,
    markets,
    wallet.publicKey,
    cancelOrderTransactions,
    fetchOpenOrdersAccounts,
    sender,
  ]);

  const handleSettleAllFunds = useCallback(async () => {
    if (!proposal || !markets) return;

    setIsSettling(true);
    try {
      // HACK: Assumes all orders are for the same market
      const pass = market.equals(proposal.account.openbookPassMarket);
      const txs = (
        await Promise.all(
          openOrdersAccounts
            .filter(
              (ooa) =>
                ooa.account.position.quoteFreeNative.toNumber() != 0 ||
                ooa.account.position.baseFreeNative.toNumber() != 0,
            )
            .map(
              async (ooa) =>
                await settleFundsTransactions(
                  ooa.account.accountNum,
                  pass,
                  proposal,
                  pass
                    ? { account: markets.pass, publicKey: market }
                    : { account: markets.fail, publicKey: market },
                ),
            ),
        )
      )
        .flat()
        .filter(Boolean);

      if (!txs) return;
      sender.send(txs as Transaction[]);
    } finally {
      setIsSettling(false);
    }
  }, [openOrdersAccounts, proposal, settleFundsTransactions]);

  return (
    <Stack py="md">
      <Text size="sm">
        If you see orders here with a settle button, you can settle them to redeem the partial fill
        amount. These exist when there is a balance available within the Open Orders Account.
      </Text>
      <Group justify="space-around">
        <Button loading={isCranking} color="blue" onClick={() => crankMarkets()}>
          Crank 🐷
        </Button>
        <Button loading={isCanceling} onClick={handleCancelAll}>
          Cancel all orders
        </Button>
        <Button
          loading={isSettling}
          color="blue"
          onClick={handleSettleAllFunds}
          disabled={openOrdersAccounts.every(
            (ooa) =>
              ooa.account.position.quoteFreeNative.toNumber() == 0 &&
              ooa.account.position.baseFreeNative.toNumber() == 0,
          )}
        >
          Settle open orders accounts
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
            {openOrdersAccounts.map((ooa) =>
              ooa.account.openOrders.map((order) => (
                <OpenOrderRow key={order.id.toString()} openOrdersAccount={ooa} order={order} />
              )),
            )}
          </Table.Tbody>
        </Table>
      ) : (
        <Text py="sm">No Orders Found</Text>
      )}
    </Stack>
  );
}
