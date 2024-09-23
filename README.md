function doGeminiPrompt_(prompt, apiKey) {
  const model = "models/gemini-1.5-pro-latest";
  const version = "v1beta";
  const url = `https://generativelanguage.googleapis.com/${version}/${model}:generateContent?key=${apiKey}`;
  const contents = [{ parts: [{ text: prompt }], role: "user" }];

  const payload = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({ contents })
  };

  const res = UrlFetchApp.fetch(url, payload);

  const response = JSON.parse(res.getContentText());

  if (response.error) {
    Logger.log(`Error: ${response.error.message}`);
    return null;
  }

  const candidates = response.candidates;
  if (!candidates || !candidates.length || !candidates[0].content?.parts) {
    Logger.log("Error: No valid response received from Gemini.");
    return null;
  }

  const textResponse = candidates[0].content.parts.find(part => part.hasOwnProperty('text'));
  if (!textResponse) {
    Logger.log("Error: No text response found in Gemini output.");
    return null;
  }

  return textResponse.text;
}
