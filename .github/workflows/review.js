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
  // console.log("Patch Data:", patchData);
  
  return patchData;
}

const CODE_REVIEW_PROMPT = `You are a senior developer tasked with conducting an in-depth code review of a provided code patch. Your review will methodically identify and categorize a range of issues including potential bugs, performance bottlenecks, security vulnerabilities, adherence to coding standards, and best practices in software design.

## Focus Areas for Review:

1. **Bugs and Logic Errors:**
   - Identify logical or syntactical errors leading to incorrect program behavior or crashes.
   - Look for off-by-one errors, null pointer exceptions, and race conditions.
   - Check for proper error handling and exception management.

2. **Performance:**
   - Suggest improvements for more efficient resource utilization, such as optimizing memory usage and processing efficiency.
   - Identify potential bottlenecks, unnecessary computations, or inefficient algorithms.
   - Look for opportunities to implement caching or memoization where appropriate.

3. **Security:**
   - Highlight potential vulnerabilities that could risk system security or data integrity.
   - Check for proper input validation and sanitization to prevent injection attacks.
   - Identify any hard-coded credentials or sensitive information.
   - Assess the use of cryptographic functions and libraries for potential weaknesses.

4. **Style/Coding Standards:**
   - Evaluate the code's adherence to established coding standards for readability and maintainability.
   - Check for consistent naming conventions, proper indentation, and appropriate comments.
   - Identify any code duplication or overly complex methods that could be refactored.

5. **Best Practices in Software Design:**
   - Assess how well the code follows principles like SOLID, design patterns, and other industry best practices for robust software development.
   - Evaluate the overall architecture and suggest improvements for modularity and extensibility.
   - Look for proper separation of concerns and abstraction levels.

6. **Test Coverage:**
   - Examine the test coverage with a focus on Statement and Branch coverage techniques.
   - Ensure that all significant code paths and decision branches are adequately tested for thorough validation of the code's functionality.
   - Identify any missing edge cases or boundary conditions in the tests.

7. **Scalability:**
   - Assess how well the code would perform under increased load or with larger datasets.
   - Identify potential bottlenecks in data structures or algorithms that might not scale well.

8. **Concurrency and Threading:**
   - Look for proper use of synchronization mechanisms in multi-threaded code.
   - Identify potential deadlocks, race conditions, or thread safety issues.

9. **Documentation:**
   - Evaluate the quality and completeness of inline comments and method/class documentation.
   - Suggest improvements for clarity and comprehensiveness in documentation.

10. **Dependency Management:**
    - Assess the use of external libraries and dependencies.
    - Look for outdated or vulnerable dependencies that should be updated.

11. **Code Complexity:**
    - Identify overly complex methods or classes that could benefit from simplification.
    - Suggest breaking down complex logic into smaller, more manageable units.

## Review Output Format:

Provide your findings in a markdown format. Structure each identified issue as a separate section, using the following format:

---
**Category**: [Bugs | Performance | Security | Style/Coding Standards | Best Practices | Test Coverage | Scalability | Concurrency | Documentation | Dependency Management | Code Complexity]

**Severity**: [Critical | High | Medium | Low]

**Description:** Provide a detailed description of the issue.

**Code Snippet:**
\`\`\`<language>
<Include the problematic code snippet from the patch, ensuring to escape any special characters.>
\`\`\`

**Suggested Code:** 
\`\`\`<language>
<Code suggestion to fix the issue, if applicable. Leave empty if there is no specific code suggestion.>
\`\`\`

**Rationale:** Explain the reasoning behind your suggestion and its potential impact.

---

## Additional Instructions:

- Maintain clear separation and readability for each issue.
- Place a strong emphasis on coding best practices and standards in your suggestions.
- Offer constructive feedback aimed at enhancing code quality, focusing on clean, efficient, secure, and maintainable coding techniques.
- In the whitebox test coverage assessment, focus specifically on Statement and Branch coverage to ensure comprehensive testing of all executable statements and decision points in the code.
- Consider the broader context of the codebase and how the changes might affect other parts of the system.
- Prioritize issues based on their potential impact on the system's functionality, performance, and security.
- Suggest alternative approaches or design patterns where appropriate, explaining their benefits.
- When reviewing performance issues, consider both time and space complexity.
- For security-related issues, reference relevant OWASP guidelines or CWE identifiers when applicable.
- Provide specific examples or scenarios to illustrate potential problems or benefits of suggested changes.`;

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
  // console.log("Gemini API Response:", result);
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


// async function postInlineComment(prUrl, commentBody, commitId, filePath, line) {
//   const match = prUrl.match(/https:\/\/github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/);
//   const owner = match[1];
//   const repo = match[2];
//   const pullNumber = match[3];
//   const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/comments`;
  
//   const response = await fetch(apiUrl, {
//     method: 'POST',
//     headers: {
//       'Authorization': `token ${process.env.GITHUB_TOKEN}`,
//       'Accept': 'application/vnd.github.v3+json',
//     },
//     body: JSON.stringify({
//       body: commentBody,
//       commit_id: commitId,
//       path: filePath,
//       line: line,
//       side: 'RIGHT'  // Comment on the new version of the file
//     }),
//   });

//   if (!response.ok) {
//     const errorText = await response.text();
//     console.log(`Failed to post inline comment: ${response.statusText}\n${errorText}`)
//     throw new Error(`Failed to post inline comment: ${response.statusText}\n${errorText}`);
//   }
//   console.log(`Inline comment posted successfully for ${filePath}:${line}`);
// }
async function postInlineComment(prUrl, commentBody, commitId, filePath, line) {
  try {
    const match = prUrl.match(/https:\/\/github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/);
    if (!match) {
      throw new Error(`Invalid PR URL: ${prUrl}`);
    }
    const [, owner, repo, pullNumber] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/comments`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        body: commentBody,
        commit_id: commitId,
        path: filePath,
        line: line,
        side: 'RIGHT'  // Comment on the new version of the file
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitHub API Error (${response.status}): ${response.statusText}`);
      console.error(`Error details: ${errorText}`);
      console.error(`Request details:
        URL: ${apiUrl}
        Method: POST
        Headers: ${JSON.stringify(response.headers)}
        Body: ${JSON.stringify({
          body: commentBody,
          commit_id: commitId,
          path: filePath,
          line: line,
          side: 'RIGHT'
        }, null, 2)}`);
      throw new Error(`Failed to post inline comment: ${response.statusText}\n${errorText}`);
    }

    console.log(`Inline comment posted successfully for ${filePath}:${line}`);
  } catch (error) {
    console.error(`Error in postInlineComment: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    throw error; // Re-throw the error for the calling function to handle
  }
}
function parseReviewResult(reviewResult) {
  const issues = reviewResult.split('---').filter(issue => issue.trim() !== '');
  return issues
    .map(issue => {
      const lines = issue.trim().split('\n');
      const category = lines.find(line => line.startsWith('**Category**:'))?.split(':')[1]?.trim() || 'Unknown';
      const severity = lines.find(line => line.startsWith('**Severity**:'))?.split(':')[1]?.trim() || 'Unknown';
      const codeSnippet = issue.match(/```[\s\S]*?```/)?.[0] || '';
      const filePath = codeSnippet.match(/File: (.+)/)?.[1] || '';
      const lineNumber = parseInt(codeSnippet.match(/Line: (\d+)/)?.[1] || '0', 10);
      
      return {
        category,
        severity,
        content: issue.trim(),
        filePath,
        lineNumber
      };
    })
    .filter(issue => (issue.category !== 'Unknown' || issue.severity !== 'Unknown') && issue.filePath && issue.lineNumber);
}

async function postInlineComments(prUrl, reviewResult, commitId) {
  const issues = parseReviewResult(reviewResult);
  for (const issue of issues) {
    const commentBody = `## Code Review Issue: ${issue.category} (${issue.severity})\n\n${issue.content}`;
    console.log(`Posting inline comment: ${commentBody}`);
    await postInlineComment(prUrl, commentBody, commitId, issue.filePath, issue.lineNumber);
  }
}

async function getLatestCommitId(prUrl) {
  const match = prUrl.match(/https:\/\/github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/);
  const owner = match[1];
  const repo = match[2];
  const pullNumber = match[3];
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/commits`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get commits: ${response.statusText}`);
  }

  const commits = await response.json();
  return commits[commits.length - 1].sha;
}

// Main function to orchestrate the PR review
(async () => {
  try {
    const patchData = await getPullRequestPatch(prUrl);
    const reviewResult = await reviewPullRequest(patchData);
    const latestCommitId = await getLatestCommitId(prUrl);
    console.log(`Last commit: ${latestCommitId}`);
    await postInlineComments(prUrl, reviewResult, latestCommitId);
    console.log('All inline review comments posted successfully.');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
})();
