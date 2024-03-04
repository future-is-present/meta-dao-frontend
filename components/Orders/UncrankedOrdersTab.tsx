import { Stack, Table, Text } from '@mantine/core';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { OpenOrderRow } from './OpenOrderRow';

const headers = ['Order ID', 'Market', 'Claimable', 'Actions'];

export function UncrankedOrdersTab({
  openOrdersAccount,
}: {
  openOrdersAccount: OpenOrdersAccountWithKey[];
}) {
  return (
    <Stack py="md">
      <Text size="sm">
        If you see orders here, you can use the cycle icon with the 12 on it next to the respective
        market which will crank it and push the orders into the Unsettled, Open Accounts below.
      </Text>
      {openOrdersAccount && openOrdersAccount.length > 0 ? (
        <Table>
          <Table.Thead>
            <Table.Tr>
              {headers.map((header) => (
                <Table.Th key={header}>{header}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {openOrdersAccount.map((ooa) =>
              ooa.account.openOrders.map((order) => (
                <OpenOrderRow openOrdersAccount={ooa} order={order} />
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
