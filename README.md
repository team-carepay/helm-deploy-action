# helm-deploy-action

A GitHub Action that bumps a value in a Helm `values.yaml` stored in GitHub.

It fetches the file via the GitHub Contents REST API, sets a single JSONPath
entry to a new value, and commits the file back to the default branch with a
`[skip ci]` message.

## Inputs

| Input        | Required | Default                | Description                                                     |
| ------------ | -------- | ---------------------- | --------------------------------------------------------------- |
| `file`       | yes      | —                      | Path to the YAML file in the repo, e.g. `apps/ussd/values.yaml` |
| `value`      | yes      | —                      | New value to set, e.g. `v1.2.3`                                 |
| `jsonpath`   | yes      | `$.microservice.image` | JSONPath of the entry to update                                 |
| `workspace`  | yes      | `carepaydev`           | GitHub owner/organisation                                       |
| `repository` | yes      | `central-configs`      | GitHub repository name                                          |
| `username`   | yes      | `carepaybot`           | Committer name for the commit                                   |
| `password`   | yes      | —                      | GitHub Personal Access Token (use a secret, never hard-code)    |

## Example

```yaml
name: Deploy

on:
  push:
    tags: ["v*"]

jobs:
  bump:
    runs-on: ubuntu-latest
    steps:
      - name: Update image tag in central-configs
        uses: carepay/helm-deploy-action@main
        with:
          file: apps/ussd/values.yaml
          value: ${{ github.ref_name }}
          jsonpath: $.microservice.image
          password: ${{ secrets.GITHUB_PAT }}
```

The step above sets `microservice.image` in `apps/ussd/values.yaml` to the
pushed tag and commits it to `carepaydev/central-configs`, relying on the
default `workspace`, `repository`, and `username`.
