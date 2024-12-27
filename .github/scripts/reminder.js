console.log(process.env);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const [REPO_OWNER, REPO_NAME] = process.env.GITHUB_REPOSITORY.split("/");
const today = new Date().toISOString().split("T")[0];

async function getIssues() {
  const query =
    `{` +
    `  repository(owner: "${REPO_OWNER}", name: "${REPO_NAME}") {` +
    `    projectsV2(first: 10) {` +
    `      nodes {` +
    `        id` +
    `        title` +
    `        items(first: 100) {` +
    `          nodes{` +
    `            id` +
    `            fieldValues(first: 5) {` +
    `              nodes{                ` +
    `                ... on ProjectV2ItemFieldDateValue {` +
    `                  date` +
    `                  field {` +
    `                    ... on ProjectV2FieldCommon {` +
    `                      name` +
    `                    }` +
    `                  }` +
    `                }` +
    `              }              ` +
    `            }` +
    `            content{` +
    `              ...on Issue {` +
    `                title` +
    `                number` +
    `              }` +
    `            }` +
    `          }` +
    `        }` +
    `      }` +
    `    }` +
    `  }` +
    `}`;
  const response = await fetch("https://api.github.com/graphql", {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
    method: "POST",
    body: JSON.stringify({ query }),
  });
  const json = await response.json();

  if (json?.errors) {
    console.dir(json.errors, { depth: null });
    throw new Error("Query error.");
  }

  if (!json?.data?.repository?.projectsV2?.nodes) {
    throw new Error("Nodes not found.");
  }

  const projects = json.data.repository.projectsV2.nodes;
  const issues = projects.reduce((acc, cur) => {
    cur.items.nodes.map((item) => {
      const start = item.fieldValues.nodes.find(
        (fieldValue) => fieldValue.field?.name === "start"
      );
      const end = item.fieldValues.nodes.find(
        (fieldValue) => fieldValue.field?.name === "end"
      );

      acc.push({
        id: item.id,
        title: item.content.title,
        number: item.content.number,
        start: start.date,
        end: end.date,
      });
    });

    return acc;
  }, []);

  return issues;
}

async function addComment(issueNumber, comment) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/comments`;
  await fetch(url, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
    method: "POST",
    body: JSON.stringify({ body: comment }),
  });
}

function isDateBetween(date, start, end) {
  const currentDate = new Date(date);
  const startDate = new Date(start);
  const endDate = new Date(end);

  return currentDate >= startDate && currentDate <= endDate;
}

async function reminder() {
  try {
    const issues = await getIssues();
    console.dir(issues, { depth: null });

    for (const issue of issues) {
      if (!isDateBetween(today, issue.start, issue.end)) {
        console.log(`No comments for issue #${issue.number}: ${issue.title}`);
        continue;
      }

      await addComment(
        issue.number,
        "🔔 Reminder: This issue is currently active based on its start and end dates."
      );
      console.log(`Added comment to issue #${issue.number}: ${issue.title}`);
    }
  } catch (error) {
    console.error(error);
  }
}

reminder();
