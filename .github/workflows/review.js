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
async function reviewPullRequest(patchData) {
  const apiKey = process.env.GEMINI_API_KEY;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `Review this code:\n\n${patchData}`,
    }),
  });
  console.log("Gemini API Response status:", res.status);

  const result = await res.json();
  console.log("Gemini API Response:", result);
  return result.choices[0].text;  // Get the AI's review from the response
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
