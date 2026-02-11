import { Buffer } from "buffer";
import * as core from "@actions/core";
import * as yaml from "js-yaml";
import jp from "jsonpath";

export async function run(): Promise<void> {
  try {
    core.info(`Starting helm deploy action`);
    const tag: string = core.getInput("tag");
    const team: string = core.getInput("team");
    const namespace: string = core.getInput("namespace");
    const app: string = core.getInput("app");
    const username: string = core.getInput("username");
    const password: string = core.getInput("password");
    const jsonpath: string = core.getInput("jsonpath");
    const country: string = core.getInput("country");
    const stage: string = core.getInput("stage");
    const workspace: string = core.getInput("workspace");
    const repository: string = core.getInput("repository");

    const valuesYamlFile = `${country}-${stage}/applications/${namespace}/${team}/${app}/values.yaml`;

    const auth =
      "Basic " +
      Buffer.from(`${username}:${password}`, "binary").toString("base64");
    const response = await fetch(
      `https://api.bitbucket.org/2.0/repositories/${workspace}/${repository}/src/HEAD/${valuesYamlFile}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Authorization: auth,
        },
      },
    );

    if (response.ok) {
      core.info(`Successfully fetched values from ${valuesYamlFile}`);
      const text = await response.text();
      const yamlDoc = yaml.load(text) as any;
      jp.value(yamlDoc, jsonpath, tag);

      const formData = new FormData();
      formData.append("author", "carepaybot <admin@carepay.com>");
      formData.append(
        "message",
        `${app} ${country}-${stage} to ${tag} [skip ci]`,
      );
      formData.append(valuesYamlFile, yaml.dump(yamlDoc));

      const response2 = await fetch(
        `https://api.bitbucket.org/2.0/repositories/${workspace}/${repository}/src`,
        {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(username + ":" + password).toString("base64"),
          },
          body: formData,
        },
      );

      if (response2.ok) {
        core.info(`Successfully updated values from ${valuesYamlFile}`);
      } else {
        core.setFailed(
          `Failed to update Bitbucket: ${response2.status} ${response2.statusText}`,
        );
      }
    } else {
      core.setFailed(
        `Failed to fetch from Bitbucket https://api.bitbucket.org/2.0/repositories/${workspace}/${repository}/src/HEAD/${valuesYamlFile}: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}
