import { Buffer } from "buffer";
import * as core from "@actions/core";
import * as yaml from "js-yaml";
import jp from "jsonpath";
import {
  ECRClient,
  BatchGetImageCommand,
  PutImageCommand,
} from "@aws-sdk/client-ecr";

export async function run(): Promise<void> {
  try {
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
        await addEcrTag(app, tag, `${country}-${stage}-${tag}`);
      } else {
        core.setFailed(
          `Failed to update Bitbucket: ${response2.status} ${response2.statusText}`,
        );
      }
    } else {
        core.setFailed(
          `Failed to fetch from Bitbucket: ${response.status} ${response.statusText}`,
        );
    }
    
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}

async function addEcrTag(
  repositoryName: string,
  sourceTag: string,
  targetTag: string,
): Promise<void> {
  const ecr = new ECRClient();
  try {
    const getCommand = new BatchGetImageCommand({
      repositoryName,
      imageIds: [{ imageTag: sourceTag }],
    });
    const getResponse = await ecr.send(getCommand);

    if (
      !getResponse.images ||
      getResponse.images.length === 0 ||
      !getResponse.images[0].imageManifest
    ) {
      throw new Error(
        `Image with tag ${sourceTag} not found in repository ${repositoryName}`,
      );
    }
    core.info(`Successfully fetched image from ECR`);

    const putCommand = new PutImageCommand({
      repositoryName,
      imageManifest: getResponse.images[0].imageManifest,
      imageTag: targetTag,
    });

    await ecr.send(putCommand);
    core.info(
      `Successfully tagged image ${sourceTag} with ${targetTag} in repository ${repositoryName}`,
    );
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Failed to tag ECR image: ${error.message}`);
    } else {
      core.setFailed("Unknown error during ECR tagging");
    }
  }
}
