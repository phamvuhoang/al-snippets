const fetch = require('node-fetch');
const { exec } = require('child_process');

// GitHub PR URL passed as an argument
const prUrl = process.argv[2];
console.log("Pull Request URL:", prUrl);

if (!prUrl) {
  console.error("No Pull Request URL provided.");
  process.exit(1);
}

// Function to fetch PR patch data
async function getPullRequestPatch(prUrl) {
  const match = prUrl.match(/https:\/\/github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/);
  if (!match) {
    throw new Error('Invalid GitHub Pull Request URL');
  }

  console.log("PR Owner:", match[1], "Repo:", match[2], "PR Number:", match[3]);
  const owner = match[1];
  const repo = match[2];
  const pullNumber = match[3];

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`;
  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3.diff',
    },
  });

  console.log("GitHub API Response Status:", response.status);

  if (!response.ok) {
    throw new Error(`Failed to fetch patch data: ${response.statusText}`);
  }

  const patchData = await response.text();
  console.log("Patch Data:", patchData);
  
  return patchData;
}

// Function to send the PR patch data to Gemini for review
// async function reviewPullRequest(patchData) {
//   const apiKey = process.env.GEMINI_API_KEY;

//   const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       prompt: `Review this code:\n\n${patchData}`,
//     }),
//   });
//   console.log("Gemini API Response status:", res.status);

//   const result = await res.json();
//   console.log("Gemini API Response:", result);
//   return result.choices[0].text;  // Get the AI's review from the response
// }

// Add the CODE_REVIEW_PROMPT constant at the top of your script
const CODE_REVIEW_PROMPT = `You are a senior developer tasked with conducting an in-depth code review of a provided code patch. 
Your review will methodically identify and categorize a range of issues including potential bugs, 
performance bottlenecks, security vulnerabilities, adherence to coding standards, and best practices in software design.

Focus Areas for Review:

- Bugs: Identify logical or syntactical errors leading to incorrect program behavior or crashes.
- Performance: Suggest improvements for more efficient resource utilization, such as optimizing memory usage and processing efficiency.
- Security: Highlight potential vulnerabilities that could risk system security or data integrity.
- Style/Coding Standards: Evaluate the code's adherence to established coding standards for readability and maintainability.
- Best Practices in Software Design: Assess how well the code follows principles like SOLID, design patterns, 
and other industry best practices for robust software development.
- Test Coverage: Examine the test coverage with a focus on Statement and Branch coverage techniques. 
Ensure that all significant code paths and decision branches are adequately tested for thorough validation of the code's functionality.

Review Output Format:

Provide your findings in a markdown format. Structure each identified issue as a separate section, using the following format:

---
**Category**: [Bugs | Performance | Security | Style/Coding Standards | Best Practices | Test Coverage]
**Description:** Provide a detailed description of the issue.
**Code Snippet:**
  \`\`\`<language>
  <Include the problematic code snippet from the patch, ensuring to escape any special characters.>
  \`\`\`
**Suggested Code:** 
  \`\`\`<language>
  <Code suggestion to fix the issue, if applicable. Leave empty if there is no specific code suggestion.>
  \`\`\`
---

Additional Instructions:

- Maintain clear separation and readability for each issue.
- Place a strong emphasis on coding best practices and standards in your suggestions.
- Offer constructive feedback aimed at enhancing code quality, focusing on clean, efficient, secure, 
and maintainable coding techniques.
- In the whitebox test coverage assessment, focus specifically on Statement and Branch coverage 
to ensure comprehensive testing of all executable statements and decision points in the code.`;

// Update the reviewPullRequest function
async function reviewPullRequest(patchData) {
  const apiKey = process.env.GEMINI_API_KEY;

  const model = "models/gemini-1.5-pro-latest";
  const version = "v1beta";
  const url = `https://generativelanguage.googleapis.com/${version}/${model}:generateContent?key=${apiKey}`;

  const prompt = `${CODE_REVIEW_PROMPT}\n\n---${patchData}---`;

  const contents = [{
    parts: [{ text: prompt }],
    role: "user"
  }];

  const payload = {
    contents
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log("Gemini API Response status:", res.status);

  const result = await res.json();
  console.log("Gemini API Response:", result);

  if (result.error) {
    throw new Error(`Gemini API Error: ${result.error.message}`);
  }

  const candidates = result.candidates;
  if (!candidates || !candidates.length || !candidates[0].content?.parts) {
    throw new Error("Error: No valid response received from Gemini.");
  }

  const textResponse = candidates[0].content.parts.find(part => part.hasOwnProperty('text'));
  if (!textResponse) {
    throw new Error("Error: No text response found in Gemini output.");
  }

  return textResponse.text;
}

// Function to post review as a comment on the PR
async function postReviewComment(prUrl, reviewResult) {
  const match = prUrl.match(/https:\/\/github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/);
  const owner = match[1];
  const repo = match[2];
  const pullNumber = match[3];

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${pullNumber}/comments`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      body: reviewResult,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to post review comment: ${response.statusText}`);
  }

  console.log('Review comment posted successfully.');
}

// Main function to orchestrate the PR review
(async () => {
  try {
    const patchData = await getPullRequestPatch(prUrl);
    const reviewResult = await reviewPullRequest(patchData);
    await postReviewComment(prUrl, reviewResult);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
})();
