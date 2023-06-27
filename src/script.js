"use strict";
function docReady(fn) {
    // see if DOM is already available
    if (document.readyState === "complete" || document.readyState === "interactive") {
        // call on next available tick
        setTimeout(fn, 1);
    }
    else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}
docReady(() => {
    document.getElementById("submit").addEventListener("click", async () => {
        const pkToken = document.getElementById("pkToken").value;
        if (pkToken.length !== 64) {
            alert("Please make sure that you copied your PluralKit token correctly!");
            return;
        }
        const submitBtn = document.getElementById("submit");
        submitBtn.setAttribute("value", "Fetching...");
        submitBtn.toggleAttribute("disabled");
        const [membersRes, switchesRes] = await Promise.all([
            fetch("https://api.pluralkit.me/v2/systems/@me/members", {
                headers: [["Authorization", pkToken]],
            }),
            fetch("https://api.pluralkit.me/v2/systems/@me/switches", {
                headers: [["Authorization", pkToken]],
            }),
        ]);
        if (membersRes.ok && switchesRes.ok) {
            const members = {};
            JSON.parse(await membersRes.text()).map((member, i, allMembers) => {
                members[member.id] = {
                    name: member.name,
                    all: 0,
                    cofront: 0,
                    count: {},
                };
            });
            const switches = JSON.parse(await switchesRes.text());
            switches.map((instance) => {
                if (instance.members.length === 1) {
                    members[instance.members[0]].all += 1;
                }
                else if (instance.members.length > 1) {
                    instance.members.map((member) => {
                        members[member].all += 1;
                        members[member].cofront += 1;
                        instance.members
                            .filter((member2) => member !== member2)
                            .map((otherMember) => {
                            if (otherMember in members[member].count) {
                                members[member].count[otherMember] += 1;
                            }
                            else {
                                members[member].count[otherMember] = 1;
                            }
                        });
                    });
                }
            });
            document.getElementById("members").replaceChildren(...Object.keys(members)
                .filter((id) => {
                return members[id].cofront > 0;
            })
                .sort((a, b) => {
                if (members[a].cofront < members[b].cofront) {
                    return 1;
                }
                else if (members[a].cofront === members[b].cofront) {
                    if (members[a].all < members[b].all) {
                        return 1;
                    }
                    else if (members[a].all === members[b].all) {
                        return 0;
                    }
                    else {
                        return -1;
                    }
                }
                else {
                    return -1;
                }
            })
                .map((id) => {
                const rootLi = document.createElement("li");
                rootLi.setAttribute("id", id);
                rootLi.innerHTML = `${members[id].name} (<code>${id}</code>) has fronted ${members[id].all} times, with ${members[id].cofront} of those sharing front with someone else (${Math.floor((members[id].cofront / members[id].all) * 10000) / 100}%). Of those times, ${members[id].name} shared front with:`;
                const childList = document.createElement("ul");
                Object.keys(members[id].count)
                    .sort((a, b) => {
                    if (members[id].count[a] < members[id].count[b]) {
                        return 1;
                    }
                    else if (members[id].count[a] === members[id].count[b]) {
                        return 0;
                    }
                    else {
                        return -1;
                    }
                })
                    .map((otherId) => {
                    const childLi = document.createElement("li");
                    childLi.innerHTML = `<a href="#${otherId}">${members[otherId].name}</a> - ${members[id].count[otherId]} times (${Math.floor((members[id].count[otherId] /
                        members[id].cofront) *
                        10000) / 100}% of cofronts, ${Math.floor((members[id].count[otherId] / members[id].all) *
                        10000) / 100}% of all)`;
                    childList.appendChild(childLi);
                });
                rootLi.appendChild(childList);
                return rootLi;
            }));
        }
        else {
            alert(`Error ${membersRes.status} - ${membersRes.statusText}`);
        }
        submitBtn.setAttribute("value", "Fetch system data");
        submitBtn.toggleAttribute("disabled");
    });
});
