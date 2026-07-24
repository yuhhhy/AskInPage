# AskInPage Privacy Policy

Effective date: July 21, 2026

AskInPage is a browser extension that lets users select text on a webpage and send it to a model service configured by the user for explanation or translation. This policy explains what data the extension processes, why it processes that data, and how the data is stored.

## Data We Process

When a user actively requests an explanation, translation, or follow-up answer, AskInPage processes and sends the following data to the model service configured by the user:

- Text selected by the user;
- Webpage context related to the selected text;
- The page title and URL;
- Follow-up questions entered by the user;
- User-configured response format requirements.

When **Quick Mode** is enabled, the webpage data sent to the model service is limited to the current paragraph and the selected text.

AskInPage sends this data only when the user actively triggers an explanation or translation. The developer of AskInPage does not operate a model proxy server and does not receive, log, or store the webpage content or questions described above. The data is sent directly to the model service configured by the user in the extension settings and is subject to that service provider's privacy policy and data processing terms.

## API Key

The API key entered by the user is stored only in the browser extension's local storage on the current device. It is not synced to other devices through the browser's synchronization feature and is not sent to the developer of AskInPage. The API key is sent only to the model service configured by the user for authentication.

If the user actively uses the **Export JSON** feature, the API key is included in the exported configuration file. The user is responsible for safeguarding that file, and AskInPage does not upload it automatically.

## Synchronized Settings

Model connection information that does not include an API key, as well as interface preferences, keyboard shortcuts, and other extension settings, may be synchronized to other browser instances signed in to the user's account through the browser's extension storage synchronization feature.

## Data Security

Remote model service URLs must use HTTPS. Local loopback addresses—`localhost`, `127.0.0.1`, and `::1`—may use HTTP to support model services running on the user's device.

## User Controls

Users may, at any time:

- Disable AskInPage from the extension popup;
- Change or delete the API key on the settings page;
- Delete model service configurations;
- Uninstall the extension to remove data stored by the extension on the current device.

## How Permissions Are Used

AskInPage uses webpage access permissions to detect text actively selected by the user, extract the necessary context, and display its interface on webpages. The extension does not send webpage content to a model service unless the user actively triggers an explanation or translation.

AskInPage uses storage permissions to save model connection configurations, interface preferences, keyboard shortcuts, and the API key. The API key is stored only in local storage on the current device.

## Policy Updates

If AskInPage's data processing practices change, this policy will be updated together with the extension version, and users will be given prominent notice when necessary.

## Contact

If you have questions about this Privacy Policy, you can submit an issue in the AskInPage GitHub repository:

https://github.com/yuhhhy/AskInPage/issues
