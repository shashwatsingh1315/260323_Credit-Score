import { fetchBoardDetails } from './actions';
import BoardClient from './BoardClient';
import { notFound } from 'next/navigation';

export default async function BoardVotingPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchBoardDetails(id);
  
  if (!data.boardRound && !data.approvalRound) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <h2>No active exception workflow for this case.</h2>
      </div>
    );
  }

  return <BoardClient data={data} />;
}