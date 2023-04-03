import * as core from '@actions/core'
import * as github from '@actions/github'
import {inspect} from 'util'


const context = github.context;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function toBool(input, defaultVal): boolean {
  if (typeof input === 'boolean') {
    return input
  } else if (typeof input === 'undefined' || input.length == 0) {
    return defaultVal
  } else {
    return input === 'true'
  }
}

async function run(): Promise<void> {
  try {
    const inputs = {
      token: core.getInput('token'),
      repository: core.getInput('repository'),
      pullRequestNumber: Number(core.getInput('pull-request-number')),
      comment: core.getInput('comment'),
      deleteBranch: toBool(core.getInput('delete-branch'), false)
    }
    core.debug(`Inputs: ${inspect(inputs)}`)

    const [owner, repo] = inputs.repository.split('/')
    core.debug(`Repo: ${inspect(repo)}`)

    const octokit = github.getOctokit(inputs.token)

    if (inputs.comment && inputs.comment.length > 0) {
      core.info('Adding a comment before closing the pull request')
      await octokit.rest.issues.createComment({
        ...context.repo,
        issue_number: inputs.pullRequestNumber,
        body: inputs.comment
      })
    }

    core.info('Closing the pull request')
    await octokit.rest.pulls.update({
      ...context.repo,
      pull_number: inputs.pullRequestNumber,
      state: 'closed'
    })

    if (inputs.deleteBranch) {
      const {data: pull} = await octokit.rest.pulls.get({
        owner: owner,
        repo: repo,
        pull_number: inputs.pullRequestNumber
      })
      core.debug(`Pull: ${inspect(pull)}`)

      const ref = 'heads/' + pull['head']['ref']
      core.debug(`Pull request head ref: ${ref}`)

      // Attempt to delete the ref. This will fail if
      // the pull request was raised from a fork.
      core.info('Attempting to delete the pull request branch')
      try {
        await octokit.rest.git.deleteRef({
          owner: owner,
          repo: repo,
          ref
        })
      } catch (error) {
        core.debug(inspect(error))
      }
    }
  } catch (error) {
    core.debug(inspect(error))
    core.setFailed(getErrorMessage(error))
  }
}

run()
