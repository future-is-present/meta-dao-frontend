import { ActionIcon, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import { IconRefresh } from '@tabler/icons-react';
import { useProposal } from '@/contexts/ProposalContext';
import { totalMetaInOrder, totalUsdcInOrder } from '@/lib/openbook';
import { OpenOrdersAccountTab } from '@/components/Orders/OpenOrdersAccountTab';
import { UnsettledOrdersTab } from '@/components/Orders/UnsettledOrdersTab';
import { UncrankedOrdersTab } from '@/components/Orders/UncrankedOrdersTab';
import { PublicKey } from '@solana/web3.js';

export function ProposalOrdersCard() {
  const wallet = useWallet();
  const { fetchOpenOrdersAccounts, proposal, openOrdersAccounts, markets } = useProposal();
  if (!openOrdersAccounts || !markets) return <></>;

  return !proposal || !markets || !openOrdersAccounts ? (
    <Group justify="center" w="100%" h="100%">
      <Loader />
    </Group>
  ) : (
    <>
      <Stack gap={2}>
        <Group justify="space-between" align="flex-start">
          <Text fw="bolder" size="xl">
            Orders
          </Text>
          <Group justify="space-between" align="flex-start">
            <Text size="lg">
              <Text span fw="bold">
                ${totalUsdcInOrder(openOrdersAccounts)}
              </Text>{' '}
              condUSDC
            </Text>
            <Text>|</Text>
            <Text size="lg">
              <Text span fw="bold">
                {totalMetaInOrder(openOrdersAccounts)}
              </Text>{' '}
              condMETA
            </Text>
          </Group>
          <ActionIcon
            variant="subtle"
            // @ts-ignore
            onClick={() => fetchOpenOrdersAccounts(wallet.publicKey)}
          >
            <IconRefresh />
          </ActionIcon>
        </Group>
        <Stack justify="start" align="start" />
      </Stack>
      <Tabs defaultValue="open">
        <Tabs.List>
          <Tabs.Tab value="open">Open</Tabs.Tab>
          <Tabs.Tab value="uncranked">Uncranked</Tabs.Tab>
          <Tabs.Tab value="unsettled">Unsettled</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="open">
          <OpenOrdersAccountTab
            openOrdersAccounts={openOrdersAccounts}
            market={proposal.account.openbookPassMarket}
          />
        </Tabs.Panel>
        <Tabs.Panel value="open">
          <OpenOrdersAccountTab
            openOrdersAccounts={openOrdersAccounts}
            market={proposal.account.openbookFailMarket}
          />
        </Tabs.Panel>
        {/* TODO binye */}
        <Tabs.Panel value="uncranked">
          <UncrankedOrdersTab openOrdersAccount={openOrdersAccounts} />
        </Tabs.Panel>
        <Tabs.Panel value="unsettled">
          <UnsettledOrdersTab openOrdersAccounts={openOrdersAccounts} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
