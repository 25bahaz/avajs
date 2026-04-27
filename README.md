***MY NETWORK MANAGER FUNCTIONAL REQUIREMENTS***

**validator manager service**
- add validator
- remove validator
- disable validator
- update weight validator
- search/filter validators
- list validator status

**allowlist manager service**
- change blockchain owner address
- add address to transaction allowlist
- add address to contract deployer allowlist
- add address to native minter allowlist
- add address to fee manager config allowlist
- remove address from transaction allowlist
- remove address from contract deployer allowlist
- remove address from native minter allowlist
- remove address from fee manager config allowlist

**fee config manager service**
- change fee config

**native token mint service**
- mint native token
- burn native token
- total supply
- mint history
- burn history

**utils**
- unit converter
- encode/decode (base58, cb58, hex etc.)
- text compare (araxis merge)
- send dummy transaction

---------- phase 2 ----------

**block explorer service(readonly)**
- list recent blocks
- search block by blockNumber

**address explorer(readonly)**
- list recent rolled addresses
- filter addresses by roles

**event indexer service(readonly)**
- list recent events
- search/filter events by name 
- search/filter events by txHash
- search/filter events by blockHash
- search/filter events by blockNumber
- filter transactions by time

**tx explorer service(readonly)**
- list recent transactions 
- search transaction by hash
- search transaction by blockHash
- search transaction by blockNumber
- search/filter transaction by status
- filter transactions by time
- filter transaction by from address
- filter transaction by to address

**rpc call service**
- available rpc calls


\documentclass[pdftex,12pt,a4paper]{article}

\usepackage{graphicx}  
\usepackage[margin=2.5cm]{geometry}
\usepackage{breakcites}
\usepackage{indentfirst}
\usepackage{pgfgantt}
\usepackage{pdflscape}
\usepackage{float}
\usepackage{epsfig}
\usepackage{epstopdf}
\usepackage[cmex10]{amsmath}
\usepackage{stfloats}
\usepackage{multirow}
\usepackage{listings}
\usepackage{xcolor}

\renewcommand{\refname}{REFERENCES}
\linespread{1.3}

\lstset{
    basicstyle=\ttfamily\small,
    keywordstyle=\color{blue},
    commentstyle=\color{gray},
    stringstyle=\color{red},
    breaklines=true
}

\thispagestyle{empty}
\begin{document}

% ---------------- TITLE PAGE SAME ----------------

\begin{titlepage}
\begin{center}
\textbf{\Large{ISTANBUL TECHNICAL UNIVERSITY}}\\
\vspace{0.5cm}
\textbf{\Large{COMPUTER ENGINEERING DEPARTMENT}}\\
\vspace{2cm}
\textbf{\Large{BLG 242E\\ DIGITAL CIRCUITS LABORATORY\\ EXPERIMENT REPORT}}\\
\vspace{2.8cm}

\begin{table}[ht]
\centering
\Large{
\begin{tabular}{lcl}
\textbf{EXPERIMENT NO}  & : & 1 \\
\textbf{EXPERIMENT DATE}  & : & 27.02.2026 \\
\textbf{LAB SESSION}  & : & FRIDAY - 14.00 \\
\textbf{GROUP NO}  & : & G5 \\
\end{tabular}}
\end{table}

\vspace{1cm}

\textbf{\Large{GROUP MEMBERS:}}\\

\begin{table}[ht]
\centering
\Large{
\begin{tabular}{rcl}
150210038  & : & MEHMET BAHADIR DURSUN \\
15024xxxx  & : & STUDENT NAME \& SURNAME \\
\end{tabular}}
\end{table}

\vspace{2.8cm}
\textbf{\Large{SPRING 2026}}

\end{center}
\end{titlepage}

\setcounter{page}{1}

% -------------------------------------------------

\section{INTRODUCTION}

In this experiment, basic combinational logic circuits were implemented using Verilog HDL and synthesized on an FPGA board. 

First, fundamental logic gates (AND, OR, NOT) were designed as separate modules. Then, a given Boolean expression was implemented structurally using these gates (Part 3). Finally, the same Boolean function was implemented behaviorally using direct assign statements (Part 4). The designs were synthesized and FPGA resource utilization was analyzed.

\section{MATERIALS AND METHODS}

\subsection{Simple Logic Gates}

Basic logic gates were implemented as separate Verilog modules.

\begin{lstlisting}[language=Verilog]
module and1(input a, input b, output c);
    assign c = a & b;
endmodule

module or1(input a, input b, output c);
    assign c = a | b;
endmodule

module not1(input a, output b);
    assign b = ~a;
endmodule
\end{lstlisting}

\subsection{Part 3 – Structural Implementation}

The Boolean expression implemented:

\[
F = ABC' + B'C'D' + BD + CD
\]

Structural modeling was used by instantiating previously defined logic gate modules.

\begin{lstlisting}[language=Verilog]
module part3(
    input [3:0] sw,    
    output [15:0] LED
    );
    
    wire A, B, C, D;
    wire result;
    
    assign A = sw[3];
    assign B = sw[2];
    assign C = sw[1];
    assign D = sw[0];
    
    assign result = (A & B & ~C) |
                    (~B & ~C & ~D) |
                    (B & D) |
                    (C & D);
    
    assign LED = result;
endmodule
\end{lstlisting}

\subsection{Part 4 – Behavioral Implementation}

In this part, the same logic expression was implemented directly using a single assign statement.

\begin{lstlisting}[language=Verilog]
module part4(
    input  wire [3:0] sw,    
    output [15:0] LED
    );
       
    assign LED = (sw[3] & sw[2] & ~sw[1]) |
                 (~sw[2] & ~sw[1] & ~sw[0]) |
                 (sw[2] & sw[0]) |
                 (sw[1] & sw[0]);
endmodule
\end{lstlisting}

\subsection{Part 4 Circuit Diagram}

The synthesized circuit schematic of Part 4 is shown below.

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{part4_circuit.png}
\caption{Schematic diagram of Part 4 circuit}
\label{fig:part4}
\end{figure}

(You should place your Part 4 circuit image in the project folder with the name \textbf{part4\_circuit.png}.)

\section{RESULTS}

After synthesis, FPGA resource utilization report was obtained.

\subsection{Slice Logic Utilization}

\begin{table}[H]
\centering
\begin{tabular}{|l|c|c|c|c|c|}
\hline
Site Type & Used & Fixed & Prohibited & Available & Util\% \\
\hline
Slice LUTs & 1 & 0 & 0 & 20800 & <0.01 \\
LUT as Logic & 1 & 0 & 0 & 20800 & <0.01 \\
LUT as Memory & 0 & 0 & 0 & 9600 & 0.00 \\
Slice Registers & 0 & 0 & 0 & 41600 & 0.00 \\
F7 Muxes & 0 & 0 & 0 & 16300 & 0.00 \\
F8 Muxes & 0 & 0 & 0 & 8150 & 0.00 \\
\hline
\end{tabular}
\caption{FPGA Slice Logic Utilization}
\end{table}

It is observed that only 1 LUT was used, and no registers were required since the design is purely combinational.

\section{DISCUSSION}

The experiment demonstrated the difference between structural and behavioral modeling in Verilog. 

In structural modeling (Part 3), the design was built by explicitly instantiating logic gate modules and connecting intermediate wires. This approach resembles hardware-level circuit construction.

In behavioral modeling (Part 4), the same Boolean function was implemented using a direct assign expression, which is more compact and easier to write.

After synthesis, both implementations produced equivalent hardware. The FPGA resource utilization showed that only one LUT was sufficient to implement the entire logic function. This indicates that the synthesis tool optimized the Boolean expression efficiently.

\section{CONCLUSION}

In this experiment, combinational logic circuits were successfully implemented using Verilog HDL. Both structural and behavioral modeling approaches were explored.

The experiment helped in understanding:
- FPGA synthesis process
- LUT-based implementation
- Structural vs behavioral modeling
- Resource utilization analysis

No major difficulties were encountered during implementation. The experiment provided practical insight into how Boolean expressions are mapped into FPGA hardware resources.

\end{document}