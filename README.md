# Chrome AutoSort

A Chrome extension that automatically groups tabs based on configurable regex.

Set up a regex eg ID-\d+ and matched tabs will be grouped like:
- ID-1234
  - ID-1234 my Jira example
  - GitHub PR Referencing ID-1234
- ID-2345
  - ID-2345 another Jira ticket
  - Another PR for ID-2345
  - ID-2345 design doc

## Installation

1. Open chrome://extensions
2. Enable Developer mode (top-right toggle)
3. Click Load unpacked and select the `chrome-autosort` directory
