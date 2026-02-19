# Edge Cases and Bug Fixes Test Suite

This test suite verifies the critical edge cases and bug fixes implemented in the Uzbek Optics Manager system.

## Prerequisites

1. Ensure the server is running on `http://localhost:5000`
2. Have admin credentials available (default: admin/admin123)
3. Database should have at least one product with inventory

## Running Tests

```bash
npm run test:edge-cases
```

## Test Cases Covered

### 1) Completed sale cannot be edited
- Creates a sale and attempts to update it
- Expects: 400 error indicating completed sales cannot be modified
- Verifies: Sales status protection is working

### 2) Mixed payment mismatch returns 400
- Creates a sale with payments that don't sum to the total
- Expects: 400 error about payment mismatch
- Verifies: Payment validation and duplicate payment prevention

### 3) Writeoff pending does not change inventory; approve changes inventory & logs
- Creates a pending writeoff adjustment
- Checks inventory hasn't changed while pending
- Approves the adjustment
- Verifies: Inventory changes after approval and audit logs are created

### 4) Low stock audit created after sale/writeoff
- Checks current inventory levels
- Creates a sale that reduces stock below minStock
- Verifies: LOW_STOCK audit log is created with proper metadata

### 5) P&L includes writeoff loss
- Creates and approves a writeoff adjustment
- Retrieves Profit & Loss report
- Verifies: Report includes writeoffLoss field with correct value

### 6) Import updates price -> price_history created
- Gets initial price history count
- Simulates CSV import with price update
- Verifies: Price history entries are created (if import succeeds)

## Expected Behavior

- Each test will show PASS/FAIL status
- Detailed error messages for failures
- Final summary with total passed/failed count
- Exit code 0 for all passed, 1 for any failures

## Notes

- Tests require a running server with database connectivity
- Some tests may fail if test data (products, inventory) is not properly set up
- The test suite attempts to handle missing authentication gracefully
- Import test may not fully work without proper test data setup

## Troubleshooting

If tests fail:
1. Check server is running: `npm run dev`
2. Verify database connection: Check database logs
3. Ensure admin user exists in database
4. Check test data: Verify products exist with inventory
5. Review test error messages for specific issues
