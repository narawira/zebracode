// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (see documentation).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, { width: 480, height: 400 });

function handleSelectionChange() {
  if (
    figma.currentPage.selection.length === 1 &&
    figma.currentPage.selection[0].type === "TEXT"
  ) {
    const textNode = figma.currentPage.selection[0] as TextNode;
    figma.ui.postMessage({ type: "state:set-text", text: textNode.characters });
  } else {
    // If the selection is not a single TextNode, clear the input
    figma.ui.postMessage({ type: "state:set-text", text: "" });
  }
}

figma.on("selectionchange", handleSelectionChange);

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = async (message) => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  let data = "";

  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (message.type === "app:generate") {
    const format = message.format;

    if (message.text) {
      data = encodeURIComponent(message.text);
    } else {
      if (
        figma.currentPage.selection.length === 0 ||
        !(figma.currentPage.selection[0].type === "TEXT")
      ) {
        figma.ui.postMessage({ type: "state:no-text-selected" });
        return;
      }

      const textNode = figma.currentPage.selection[0] as TextNode;
      data = encodeURIComponent(textNode.characters);
    }

    try {
      const response = await fetch(
        `https://zebra-code.p.rapidapi.com/?data=${data}&type=${format}`,
        {
          method: "GET",
          headers: {
            "X-RapidAPI-Key": "9177ead490msha2000b73cf6ac13p1545c0jsn8e9e83d0fed7", // Default API Key
            "X-RapidAPI-Host": "zebra-code.p.rapidapi.com",
          },
        }
      );

      const imageData = (await response.json()).image;

      if (!imageData) {
        if (response.status === 403) {
          throw new Error("API Key is invalid or expired");
        } else if (response.status === 429) {
          throw new Error(
            "API Request exceeded capacity."
          );
        } else {
          throw new Error(
            "Oops! Barcode generation failed, please try again later."
          );
        }
      }

      const formatName = format.replace(/\-/gm, " ");
      const frame = figma.createFrame();
      frame.name = formatName + " - " + decodeURIComponent(data);
      frame.resize(512, 640);

      const label = figma.createText();
      label.characters = decodeURIComponent(message.text);
      label.fontSize = 36;
      label.lineHeight = { value: 48, unit: "PIXELS" };
      label.textAlignHorizontal = "CENTER";
      label.textAlignVertical = "CENTER";
      label.x = frame.width / 2 - label.width / 2;
      label.y = frame.height - 128 + label.height;

      frame.appendChild(label);

      const rectangle = figma.createNodeFromSvg(imageData);
      rectangle.x = 20;

      if (format === "QR_CODE") {
        rectangle.y = 20;
        rectangle.resize(frame.width - 40, frame.width - 40);
      } else {
        rectangle.y = frame.height / 2 - rectangle.height / 2;
        rectangle.resize(frame.width - 40, rectangle.height);

        const labelFormat = figma.createText();
        labelFormat.characters = formatName;
        labelFormat.fontSize = 48;
        labelFormat.lineHeight = { value: 58, unit: "PIXELS" };
        labelFormat.textAlignHorizontal = "CENTER";
        labelFormat.textAlignVertical = "CENTER";
        labelFormat.x = frame.width / 2 - labelFormat.width / 2;
        labelFormat.y = 124;

        frame.appendChild(labelFormat);
      }

      frame.appendChild(rectangle);

      figma.currentPage.appendChild(frame);

      const frames = figma.currentPage.children.filter(
        (node) => node.type === "FRAME"
      ) as FrameNode[];
      const lastFrame = frames[frames.length - 2];

      if (lastFrame) {
        frame.x = lastFrame.x + lastFrame.width + 20;
        frame.y = lastFrame.y;
      }

      figma.ui.postMessage({ type: "state:finish" });
    } catch (e: any) {
      figma.ui.postMessage({ type: "state:finish" });
      figma.notify(
        e.message
          ? e.message
          : "Oops! Barcode generation failed, please try again later.",
        {
          error: true,
          timeout: 3000,
        }
      );
    }
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  // figma.closePlugin();
};
