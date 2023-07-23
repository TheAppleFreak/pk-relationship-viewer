import "mvp.css/mvp.css";
import "./tweaks.css";

function docReady(fn: () => void): void {
    // see if DOM is already available
    if (document.readyState === "complete" || document.readyState === "interactive") {
        // call on next available tick
        setTimeout(fn, 1);
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}

docReady(() => {
    document.getElementById("submit")!.addEventListener("click", async () => {
        const pkToken = (document.getElementById("pkToken")! as HTMLInputElement).value;
        const switchCount = Number(
            (document.getElementById("switchCount")! as HTMLInputElement).value
        );

        if (pkToken.length !== 64) {
            alert("Please make sure that you copied your PluralKit token correctly!");
            return;
        }

        const submitBtn = document.getElementById("submit")!;
        submitBtn.setAttribute("value", "Fetching...");
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.toggleAttribute("disabled");

        const membersRes = await fetch(
            "https://api.pluralkit.me/v2/systems/@me/members",
            {
                headers: [["Authorization", pkToken]]
            }
        );

        if (membersRes.ok) {
            const members: {
                [key: string]: {
                    name: string;
                    all: number;
                    cofront: number;
                    count: {
                        [key: string]: {
                            time: number;
                            count: number;
                        };
                    };
                };
            } = {};

            (
                JSON.parse(await membersRes.text()) as {
                    id: string;
                    name: string;
                    [key: string]: any;
                }[]
            ).map((member) => {
                members[member.id] = {
                    name: member.name,
                    all: 0,
                    cofront: 0,
                    count: {}
                };
            });

            const switches: {
                id: string;
                timestamp: string;
                members: string[];
            }[] = [];

            let lastTimestamp: string;

            do {
                await new Promise((resolve) => setTimeout(resolve, 300));

                const res = await fetch(
                    `https://api.pluralkit.me/v2/systems/@me/switches${
                        lastTimestamp ? `?before=${lastTimestamp}` : ""
                    }`,
                    {
                        headers: [["Authorization", pkToken]]
                    }
                );

                const switchBatch = JSON.parse(await res.text());
                if (switchBatch.length > 0) {
                    switches.push(...switchBatch);

                    lastTimestamp = switches[switches.length - 1].timestamp;
                } else {
                    break;
                }
            } while (switchCount < 0 ? true : switches.length < switchCount);

            switches.map((instance, index) => {
                if (instance.members.length === 1) {
                    members[instance.members[0]].all += 1;
                } else if (instance.members.length > 1) {
                    instance.members.map((member) => {
                        members[member].all += 1;
                        members[member].cofront += 1;

                        instance.members
                            .filter((member2) => member !== member2)
                            .map((otherMember) => {
                                const time: number =
                                    index > 0
                                        ? Math.abs(
                                              new Date(
                                                  switches[index].timestamp
                                              ).valueOf() -
                                                  new Date(
                                                      switches[index - 1].timestamp
                                                  ).valueOf()
                                          )
                                        : 0;

                                if (otherMember in members[member].count) {
                                    members[member].count[otherMember].time += time;
                                    members[member].count[otherMember].count += 1;
                                } else {
                                    members[member].count[otherMember] = {
                                        time: time,
                                        count: 1
                                    };
                                }
                            });
                    });
                }
            });

            document.getElementById("members")!.replaceChildren(
                ...Object.keys(members)
                    .filter((id) => {
                        return members[id].cofront > 0;
                    })
                    .sort((a, b) => {
                        if (members[a].cofront < members[b].cofront) {
                            return 1;
                        } else if (members[a].cofront === members[b].cofront) {
                            if (members[a].all < members[b].all) {
                                return 1;
                            } else if (members[a].all === members[b].all) {
                                return 0;
                            } else {
                                return -1;
                            }
                        } else {
                            return -1;
                        }
                    })
                    .map((id) => {
                        const rootLi = document.createElement("li");
                        rootLi.setAttribute("id", id);
                        rootLi.innerHTML = `${
                            members[id].name
                        } (<code>${id}</code>) has fronted ${
                            members[id].all
                        } times, with ${
                            members[id].cofront
                        } of those sharing front with someone else (${
                            Math.floor(
                                (members[id].cofront / members[id].all) * 10000
                            ) / 100
                        }%). Of those times, ${members[id].name} shared front with:`;

                        const childList = document.createElement("ul");
                        Object.keys(members[id].count)
                            .sort((a, b) => {
                                if (members[id].count[a].count < members[id].count[b].count) {
                                    return 1;
                                } else if (
                                    members[id].count[a].count === members[id].count[b].count
                                ) {
                                    return 0;
                                } else {
                                    return -1;
                                }
                            })
                            .map((otherId) => {
                                const childLi = document.createElement("li");
                                childLi.innerHTML = `<a href="#${otherId}">${
                                    members[otherId].name
                                }</a> - ${members[id].count[otherId].count} times (${
                                    Math.floor(
                                        (members[id].count[otherId].count /
                                            members[id].cofront) *
                                            10000
                                    ) / 100
                                }% of co-fronts/co-cons, ${
                                    Math.floor(
                                        (members[id].count[otherId].count /
                                            members[id].all) *
                                            10000
                                    ) / 100
                                }% of all) - ${((time: number) => {
                                    const h = Math.floor(time / 3600);
                                    const m = Math.floor((time % 3600) / 60);
                                    const s = Math.round(time % 60);
                                    return `${h > 0 ? `${h} hours, ` : ``}${
                                        m > 0 ? `${m} minutes, ` : ``
                                    }${s} seconds`;
                                })(members[id].count[otherId].time / 1000)}`;

                                childList.appendChild(childLi);
                            });

                        rootLi.appendChild(childList);
                        return rootLi;
                    })
            );
        } else {
            alert(`Error ${membersRes.status} - ${membersRes.statusText}`);
        }

        submitBtn.setAttribute("value", "Fetch system data");
        submitBtn.setAttribute("aria-busy", "false");
        submitBtn.toggleAttribute("disabled");
    });
});
