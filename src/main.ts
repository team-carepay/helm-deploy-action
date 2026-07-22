import { Buffer } from "buffer";
import * as core from "@actions/core";
import * as yaml from "js-yaml";
import jp from "jsonpath";

export async function run(): Promise<void> {
  try {
    core.info(`Starting helm deploy action`);
    const username: string = core.getInput("username");
    const password: string = core.getInput("password");
    const jsonpath: string = core.getInput("jsonpath");
    const workspace: string = core.getInput("workspace");
    const repository: string = core.getInput("repository");
    const file: string = core.getInput("file");
    const value: string = core.getInput("value");

    const url = `https://api.github.com/repos/${workspace}/${repository}/contents/${file}`;
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${password}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      core.setFailed(
        `Failed to fetch from GitHub ${url}: ${response.status} ${response.statusText}`,
      );
      return;
    }

    core.info(`Successfully fetched values from ${file}`);
    const meta = (await response.json()) as { content: string; sha: string };
    const text = Buffer.from(meta.content, "base64").toString("utf-8");
    const yamlDoc = yaml.load(text) as any;
    jp.value(yamlDoc, jsonpath, value);

    const response2 = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `${file} to ${value} [skip ci]`,
        content: Buffer.from(yaml.dump(yamlDoc), "utf-8").toString("base64"),
        sha: meta.sha,
        committer: { name: username, email: "admin@carepay.com" },
      }),
    });

    if (response2.ok) {
      core.info(`Successfully updated values from ${file}`);
    } else {
      core.setFailed(
        `Failed to update GitHub: ${response2.status} ${response2.statusText}`,
      );
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}
