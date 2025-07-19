# Implementation Plan

## Core Changes

- [ ] 1. Update trigger detection for PR descriptions

  - Modify `src/github/validation/trigger.ts` to parse PR body text
  - Add `@usta execute <file_path>` pattern matching
  - Support multiple triggers in PR descriptions
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Add simple file finder

  - Create basic file resolution with exact path matching
  - Add fuzzy matching for partial paths
  - Return null if file not found or ambiguous
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3. Simplify Claude Code execution

  - Update `src/create-prompt/index.ts` to pass file path only
  - Remove complex prompt generation logic
  - Execute with `/execute <file_path>` command
  - _Requirements: 2.8, 2.10_

- [ ] 4. Use existing git operations
  - Leverage existing commit and push functionality
  - Add simple error handling for git failures
  - _Requirements: 4.4, 4.5_

## Cleanup

- [ ] 5. Remove issue support

  - Remove issue event handling from triggers
  - Clean up issue-related code paths
  - _Requirements: 6.1_

- [ ] 6. Remove assignee/label triggers

  - Remove assignee and label trigger logic
  - _Requirements: 6.2_

- [ ] 7. Remove custom instructions

  - Remove instruction parsing and processing
  - _Requirements: 6.3_

- [ ] 8. Update action configuration
  - Modify `action.yml` for new workflow
  - Remove unused input parameters
  - _Requirements: 6.4, 6.5_

## Testing

- [ ] 9. Add basic tests

  - Test trigger parsing for PR descriptions
  - Test file resolution logic
  - Test simplified execution flow
  - _Requirements: All_

- [ ] 10. Validate end-to-end flow
  - Test complete workflow from PR trigger to commit
  - Verify error handling works correctly
  - _Requirements: All_
