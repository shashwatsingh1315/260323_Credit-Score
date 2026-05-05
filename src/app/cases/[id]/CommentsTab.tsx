"use client";
import { use } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import MentionInput from '@/components/MentionInput';

export default function CommentsTab({ coreData, promises }: any) {
  const c = coreData.case;
  const { comments, users } = use(promises.commentsPromise as Promise<any>);
  const data = { comments, users };

  return (
    <div className="space-y-4 mt-6">
          <div className="space-y-4">
            <Card className="print:hidden">
              <CardContent className="p-4 bg-muted/30">
                <MentionInput
                  caseId={c.id}
                  users={data.users ?? []}
                />
              </CardContent>
            </Card>
            {data.comments.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No comments yet.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {data.comments.map((cm: any) => (
                  <Card key={cm.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-medium">{cm.author?.full_name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">{new Date(cm.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm">
                        {cm.body.split(/(@\w[\w\s]*?)(?=\s|$|@)/g).map((part: string, i: number) => (
                          part.startsWith('@')
                            ? <span key={i} className="text-primary font-medium">{part}</span>
                            : <span key={i}>{part}</span>
                        ))}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

          </div>

    </div>
  );
}
