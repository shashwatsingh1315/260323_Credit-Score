sed -i -e '/expect(mockUpdate).toHaveBeenCalledWith({ active_stage: 2 });/i \
      mockSingle.mockResolvedValueOnce({ data: { case_number: "CASE-123", rm_user_id: "rm1" } });' src/utils/engine.test.ts

sed -i -e '/expect(mockUpdate).toHaveBeenCalledWith({ active_stage: 3 });/i \
      mockSingle.mockResolvedValueOnce({ data: { case_number: "CASE-123", rm_user_id: "rm1" } });' src/utils/engine.test.ts

sed -i -e '/await returnForRevision({/i \
      mockSingle.mockResolvedValueOnce({ data: { case_number: "CASE-123", rm_user_id: "rm1" } });' src/utils/engine.test.ts

sed -i -e '/await withdrawCase({/i \
      mockSingle.mockResolvedValueOnce({ data: { case_number: "CASE-123", rm_user_id: "rm1" } });' src/utils/engine.test.ts
