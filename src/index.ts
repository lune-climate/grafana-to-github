import { RequestError } from '@octokit/request-error'
import axios, { AxiosInstance } from 'axios'
import { program } from 'commander'
import sha1 from 'crypto-js/sha1.js'
import { Octokit } from 'octokit'

program
    .option('-g, --grafana <grafana>', 'Grafana URL')
    .option('-o, --owner <owner>', 'Github repository owner')
    .option('-r, --repo <repo>', 'Github repository')
    .option('-d, --directory <directory>', 'Repository directory to save dashboards to')
    .parse(process.argv)

type DashboardData = {
    meta: {
        provisionedExternalId: string
        slug: string
    }
    dashboard: string
}

async function getGrafanaDashboardUids(axios: AxiosInstance): Promise<string[]> {
    const response = await axios.get('/api/search?type=dash-db')
    const data = response.data
    return data.map(({ uid }: { uid: string }) => uid)
}

async function getDashboard(
    axios: AxiosInstance,
    uid: string,
): Promise<{ filename: string; dashboard: string }> {
    const response = await axios.get(`/api/dashboards/uid/${uid}`)
    const data = response.data as DashboardData
    const { meta, dashboard } = data

    // sometimes grafana has the original filename in `provisionedExternalId`
    const filename =
        meta.provisionedExternalId !== '' ? meta.provisionedExternalId : `${meta.slug}.json`

    return { filename, dashboard: JSON.stringify(dashboard, null, 2) }
}

async function getFileContent(
    octokit: Octokit,
    owner: string,
    repo: string,
    directory: string,
    filename: string,
): Promise<string | undefined> {
    try {
        const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: `${directory}/${filename}`,
            mediaType: {
                format: 'raw',
            },
        })

        // error TS2345: Argument of type '{ type: "dir" | "file" | "submodule" | "symlink"; size: number; name: string; path: string; content?: string | undefined; sha: string; url: string; git_url: string | null; html_url: string | null; download_url: string | null; _links: { ...; }; }[] | { ...; } | { ...; } | { ...; }' is not assignable to parameter of type 'string | WordArray'.
        //   Type '{ type: "dir" | "file" | "submodule" | "symlink"; size: number; name: string; path: string; content?: string | undefined; sha: string; url: string; git_url: string | null; html_url: string | null; download_url: string | null; _links: { ...; }; }[]' is not assignable to type 'string | WordArray'.
        //     Type '{ type: "dir" | "file" | "submodule" | "symlink"; size: number; name: string; path: string; content?: string | undefined; sha: string; url: string; git_url: string | null; html_url: string | null; download_url: string | null; _links: { ...; }; }[]' is missing the following properties from type 'WordArray': words, sigBytes, clamp, clone
        //
        // the above is an array but `response.data` is a string at runtime.
        const data = response.data as unknown as string
        return data
    } catch (err) {
        if (err instanceof RequestError) {
            if (err.status === 404) {
                return undefined
            }
        }
        throw err
    }
}

async function shouldUpdateFile(
    octokit: Octokit,
    owner: string,
    repo: string,
    directory: string,
    filename: string,
    dashboard: DashboardData['dashboard'],
): Promise<boolean> {
    const data = await getFileContent(octokit, owner, repo, directory, filename)
    if (!data) {
        return true
    }

    const githubDashboardSha1 = sha1(data)
    const newDashboardSha1 = sha1(dashboard)

    return githubDashboardSha1 !== newDashboardSha1
}

async function getLatestCommitSha(octokit: Octokit, owner: string, repo: string): Promise<string> {
    const commits = await octokit.rest.repos.listCommits({ owner, repo })
    return commits.data[0].sha
}

async function createPullRequest(
    octokit: Octokit,
    owner: string,
    repo: string,
    directory: string,
    branch: string,
    dashboards: { filename: string; dashboard: string }[],
): Promise<void> {
    const subject = 'Update grafana dashboards'
    const latestSha = await getLatestCommitSha(octokit, owner, repo)

    const files = dashboards.map(({ filename, dashboard }) => ({
        path: `${directory}/${filename}`,
        mode: '100644' as const,
        type: 'commit' as const,
        content: dashboard,
    }))

    const {
        data: { sha: newSha },
    } = await octokit.rest.git.createTree({
        owner,
        repo,
        tree: files,
        base_tree: latestSha,
        message: subject,
        parents: [latestSha],
    })

    const {
        data: { sha: newCommitSHA },
    } = await octokit.rest.git.createCommit({
        owner,
        repo,
        tree: newSha,
        message: subject,
        parents: [latestSha],
    })

    await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: newCommitSHA,
    })

    await octokit.rest.pulls.create({
        owner,
        repo,
        head: branch,
        base: 'master',
        title: subject,
    })

    console.log(`Pull request created`)
}

async function main(): Promise<void> {
    const options = program.opts()
    const { grafana, owner, repo, directory } = options
    if (!grafana || !owner || !repo || !directory) {
        program.help()
        return
    }

    const grafanaUsername = process.env.GRAFANA_USERNAME
    const grafanaPassword = process.env.GRAFANA_PASSWORD

    if (!grafanaUsername || !grafanaPassword) {
        console.log('GRAFANA_USERNAME and GRAFANA_PASSWORD environment variables are required')
        return
    }

    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) {
        console.log('GITHUB_TOKEN environment variable is required')
        return
    }

    const grafanaClient = axios.create({
        baseURL: options.grafana,
        timeout: 10000,
        auth: {
            username: grafanaUsername,
            password: grafanaPassword,
        },
    })

    const githubClient = new Octokit({ auth: githubToken })

    const dashboardUids = await getGrafanaDashboardUids(grafanaClient)

    const dashboards: { filename: string; dashboard: string }[] = (
        await Promise.all(
            dashboardUids.map(async (uid) => {
                const dashboard = await getDashboard(grafanaClient, uid)
                return {
                    ...dashboard,
                    shouldUpdate: await shouldUpdateFile(
                        githubClient,
                        owner,
                        repo,
                        directory,
                        dashboard.filename,
                        dashboard.dashboard,
                    ),
                }
            }),
        )
    ).filter(({ shouldUpdate }) => shouldUpdate === true)

    if (!dashboards.length) {
        console.log('No changes')
        return
    }

    await createPullRequest(githubClient, owner, repo, directory, 'grafana-dashboards', dashboards)
}

main()
