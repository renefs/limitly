# Limitly - Limit your time on websites

## What it does

Limitly is a Chrome Extension that helps you stay productive and focused by limiting your time on specific websites. By categorizing websites and keeping track of your browsing habits, Limitly actively helps you prevent endless scrolling and time-wasting.

## Why use it

- **Stay Focused:** Prevent distractions by blocking or limiting access to time-consuming websites.
- **Form Better Habits:** Become aware of how you spend your time online and make conscious choices.
- **Customizable:** Categorize websites and set custom time limits based on your personal needs.
- **Privacy First:** Your data operates locally on your browser.

## Chrome Store

Download and install Limitly directly from the Chrome Web Store:
👉 [Link to Chrome Web Store](#) *(Coming soon!)*

## How to use it

1. Click on the Limitly icon in your browser toolbar to open the popup.
2. Open the **Settings** (Options page).
3. Add websites you want to restrict and assign them to a category.
4. Set daily time limits for those categories.
5. Limitly will track your time on these websites and block them once you reach your daily allowance.

## How to install it (Manual Installation)

If you prefer to install the extension manually from the source code, follow these steps:

1. Clone this repository or download the ZIP file.
   ```bash
   git clone https://github.com/renefs/limitly.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click on **Load unpacked**.
5. Select the `extension/` directory from the cloned repository.
6. The extension is now installed and ready to use!

## Development

To kickstart development with this extension:

1. Clone the repository.
2. The core source code for the extension is located in the `extension/` directory.
   - `manifest.json`: Configuration and metadata.
   - `js/`: Background service workers, content scripts, and UI logic.
   - `html/`: Popup and options page structure.
   - `styles/`: CSS for UI elements.
3. Make your changes and reload the extension from `chrome://extensions/` by clicking the refresh icon on the Limitly card.

## Packaging

```
zip -r limitly.zip extension/
```

## Contributing

Contributions are always welcome! 

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

Please ensure your code follows the existing style and is well documented.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.