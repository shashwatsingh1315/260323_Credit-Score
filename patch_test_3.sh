sed -i -e 's/status: '\''Closed'\''/status: '\''Withdrawn'\''/' src/utils/engine.test.ts

# For progressStage we need to mock single twice in those tests because it is called twice now:
# 1. review_cycles
# 2. credit_cases

# Test 1
sed -i -e '/await progressStage('\''cycle-1'\'', 1, '\''actor-1'\'');/i \
      mockSingle.mockResolvedValueOnce({ data: { case_id: '\''c1'\'', policy_snapshot_id: '\''p1'\'' } });\n      mockSingle.mockResolvedValueOnce({ data: { case_number: "CASE-123", rm_user_id: "rm1" } });' src/utils/engine.test.ts

# Since the previous patches added mockSingle multiple times incorrectly, let's fix it by rewriting the progressStage describe block.
