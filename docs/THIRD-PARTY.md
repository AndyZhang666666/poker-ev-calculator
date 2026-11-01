# 开源来源与复用位置

本轮沿用原仓库 MIT 许可。第三方代码保留各自版权；项目名称或界面变化不改变这些义务。

| 来源 | 固定版本 | 实际复用 | 本项目的接入与扩展 |
| --- | --- | --- | --- |
| [thlorenz/phe](https://github.com/thlorenz/phe) | npm 0.6.0；上游提交 6cfea3703b050fda8dfc8d934ceeb4d3df331d6d | 五至七张牌的牌型评估与牌编码 | 范围解析、组合权重、已知牌排除、局面枚举、抽样与区间、线程和结果快照 |
| [n1kFord/preflop-range-trainer](https://github.com/n1kFord/preflop-range-trainer) | eea16429a00d3b2d172566830b659e2f8b6b9762 | Chart.tsx 的矩阵键盘移动结构；src/utils/data/index.ts 的组合计数辅助函数 | 用现有站点风格重写呈现，增加 roving tabindex、可读名称、权重、只读证据矩阵与高亮；计数入口补充校验 |

许可全文：[phe](../third-party/phe.LICENSE)、[Preflop Range Trainer](../third-party/preflop-range-trainer.LICENSE)。npm 依赖与锁定文件一起提交。

没有复制上游整套应用或其全部训练流程。没有引入 WASM Postflop、TexasSolver 或商业 GTO 范围。内置五个位置范围和 30 手教学说明为本项目编写，所有题目明确按给定参考评分。

独立对照脚本 scripts/reference-poker.mjs 直接枚举五张牌子集，未调用生产评估器的查表数据。它用于检查牌型结果，不证明教学范围是完整最优策略。
