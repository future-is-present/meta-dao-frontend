import { useCallback, useState } from 'react';
import {
  ActionIcon,
  Group,
  Stack,
  Table,
  Text,
  useMantineTheme,
  Input,
  Tooltip,
} from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import numeral from 'numeral';
import {
  IconTrash,
  Icon3dRotate,
  IconWriting,
  IconEdit,
  IconPencilCancel,
  IconCheck,
} from '@tabler/icons-react';
import { BN } from '@coral-xyz/anchor';
import { OpenOrder, OpenOrdersAccountWithKey } from '@/lib/types';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { NUMERAL_FORMAT, BASE_FORMAT, QUOTE_LOTS } from '@/lib/constants';
import { useProposal } from '@/contexts/ProposalContext';
import { isBid, isPartiallyFilled, isPass } from '@/lib/openbook';

export function OpenOrderRow({
  openOrdersAccount,
  order,
}: {
  openOrdersAccount: OpenOrdersAccountWithKey;
  order: OpenOrder;
}) {
  const { markets } = useProposal();
  const theme = useMantineTheme();
  const sender = useTransactionSender();
  const wallet = useWallet();
  const { generateExplorerLink } = useExplorerConfiguration();
  const { proposal, fetchOpenOrdersAccounts } = useProposal();
  const { settleFundsTransactions, cancelOrderTransactions, editOrderTransactions } =
    useOpenbookTwap();

  const [isCanceling, setIsCanceling] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<OpenOrdersAccountWithKey | undefined>();
  const [editedSize, setEditedSize] = useState<number>();
  const [editedPrice, setEditedPrice] = useState<number>();
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const handleCancel = useCallback(async () => {
    if (!proposal || !markets) return;

    const txs = await cancelOrderTransactions(
      openOrdersAccount.publicKey,
      new BN(openOrdersAccount.account.accountNum),
      proposal.account.openbookPassMarket.equals(openOrdersAccount.account.market)
        ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
        : { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
    );

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
    openOrdersAccount,
    proposal,
    markets,
    wallet.publicKey,
    cancelOrderTransactions,
    fetchOpenOrdersAccounts,
    sender,
  ]);

  const handleEdit = useCallback(async () => {
    if (!proposal || !markets || !editingOrder) return;

    const price =
      editedPrice || numeral(order.lockedPrice.toString()).multiply(QUOTE_LOTS).value()!;
    const size =
      editedSize ||
      (isBid(order)
        ? openOrdersAccount.account.position.bidsBaseLots
        : openOrdersAccount.account.position.asksBaseLots
      ).toNumber();
    const txs = (
      await editOrderTransactions({
        openOrdersAccount,
        order,
        accountIndex: order.clientId,
        amount: size,
        price,
        limitOrder: true,
        ask: !isBid(order),
        market: isPass(openOrdersAccount, proposal)
          ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
          : { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
      })
    )
      ?.flat()
      .filter(Boolean);
    if (!wallet.publicKey || !txs) return;
    try {
      setIsEditing(true);
      await sender.send(txs);
      await fetchOpenOrdersAccounts(wallet.publicKey);
      setEditingOrder(undefined);
    } finally {
      setIsEditing(false);
    }
  }, [
    openOrdersAccount,
    proposal,
    markets,
    wallet.publicKey,
    editedSize,
    editedPrice,
    editOrderTransactions,
    fetchOpenOrdersAccounts,
    sender,
  ]);

  const handleSettleFunds = useCallback(async () => {
    if (!proposal || !markets) return;

    setIsSettling(true);
    try {
      const pass = openOrdersAccount.account.market.equals(proposal.account.openbookPassMarket);
      const txs = await settleFundsTransactions(
        openOrdersAccount.account.accountNum,
        pass,
        proposal,
        pass
          ? { account: markets.pass, publicKey: proposal.account.openbookPassMarket }
          : { account: markets.fail, publicKey: proposal.account.openbookFailMarket },
      );

      if (!txs) return;
      await sender.send(txs);
    } finally {
      setIsSettling(false);
    }
  }, [openOrdersAccount, proposal, settleFundsTransactions]);

  return (
    <Table.Tr key={openOrdersAccount.publicKey.toString()}>
      <Table.Td>
        <a
          href={generateExplorerLink(openOrdersAccount.publicKey.toString(), 'account')}
          target="_blank"
          rel="noreferrer"
        >
          {openOrdersAccount.account.accountNum}
        </a>
      </Table.Td>
      <Table.Td>
        <Group justify="flex-start" align="center" gap={10}>
          <IconWriting
            color={
              isPass(openOrdersAccount, proposal) ? theme.colors.green[9] : theme.colors.red[9]
            }
            scale="xs"
          />
          <Stack gap={0} justify="flex-start" align="flex-start">
            <Text>{isPass(openOrdersAccount, proposal) ? 'PASS' : 'FAIL'}</Text>
            <Text size="xs" c={isBid(order) ? theme.colors.green[9] : theme.colors.red[9]}>
              {isBid(order) ? 'Bid' : 'Ask'}
            </Text>
          </Stack>
        </Group>
      </Table.Td>
      <Table.Td>{isPartiallyFilled(openOrdersAccount) ? 'Partial Fill' : 'Open'}</Table.Td>
      <Table.Td>
        {/* Size */}
        {editingOrder === openOrdersAccount ? (
          <Input
            w="5rem"
            variant="filled"
            defaultValue={numeral(
              isBid(order)
                ? openOrdersAccount.account.position.bidsBaseLots
                : openOrdersAccount.account.position.asksBaseLots,
            ).format(BASE_FORMAT)}
            onChange={(e) => setEditedSize(Number(e.target.value))}
          />
        ) : (
          numeral(
            isBid(order)
              ? openOrdersAccount.account.position.bidsBaseLots
              : openOrdersAccount.account.position.asksBaseLots,
          ).format(BASE_FORMAT)
        )}
      </Table.Td>
      <Table.Td>
        {/* Price */}
        {editingOrder === openOrdersAccount ? (
          <Input
            w="5rem"
            variant="filled"
            defaultValue={numeral(order.lockedPrice * QUOTE_LOTS).format(NUMERAL_FORMAT)}
            onChange={(e) => setEditedPrice(Number(e.target.value))}
          />
        ) : (
          `$${numeral(order.lockedPrice * QUOTE_LOTS).format(NUMERAL_FORMAT)}`
        )}
      </Table.Td>
      <Table.Td>
        {/* Notional */}$
        {editingOrder === openOrdersAccount
          ? numeral(
              (editedPrice || order.lockedPrice * QUOTE_LOTS) *
                (editedSize ||
                  (isBid(order)
                    ? openOrdersAccount.account.position.bidsBaseLots
                    : openOrdersAccount.account.position.asksBaseLots)),
            ).format(NUMERAL_FORMAT)
          : numeral(
              isBid(order)
                ? openOrdersAccount.account.position.bidsBaseLots * order.lockedPrice * QUOTE_LOTS
                : openOrdersAccount.account.position.asksBaseLots * order.lockedPrice * QUOTE_LOTS,
            ).format(NUMERAL_FORMAT)}
      </Table.Td>
      <Table.Td>
        {isPartiallyFilled(openOrdersAccount) && (
          <Tooltip label="Settle funds">
            <ActionIcon variant="outline" loading={isSettling} onClick={() => handleSettleFunds()}>
              <Icon3dRotate />
            </ActionIcon>
          </Tooltip>
        )}
        <Group gap="sm">
          <Tooltip
            label="Cancel openOrdersAccount"
            events={{ hover: true, focus: true, touch: false }}
          >
            <ActionIcon variant="outline" loading={isCanceling} onClick={() => handleCancel()}>
              <IconTrash />
            </ActionIcon>
          </Tooltip>
          {editingOrder === openOrdersAccount ? (
            <Group gap="0.1rem">
              <Tooltip label="Submit" events={{ hover: true, focus: true, touch: false }}>
                <ActionIcon
                  c="green"
                  variant="outline"
                  loading={isEditing}
                  onClick={() => handleEdit()}
                >
                  <IconCheck />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Cancel" events={{ hover: true, focus: true, touch: false }}>
                <ActionIcon
                  c="red"
                  variant="outline"
                  onClick={() => setEditingOrder(() => undefined)}
                >
                  <IconPencilCancel />
                </ActionIcon>
              </Tooltip>
            </Group>
          ) : (
            <Tooltip
              label="Edit openOrdersAccount"
              events={{ hover: true, focus: true, touch: false }}
            >
              <ActionIcon
                variant="outline"
                onClick={() => setEditingOrder(() => openOrdersAccount)}
              >
                <IconEdit />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
